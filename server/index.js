const express = require("express");
const bodyParser = require("body-parser");
const db = require("./config/db");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const sessions = {};

// Function to process USSD requests
const processUSSD = async (req, res) => {
    const sessionId = req.body.sessionId || req.query.sessionId || `debug-${Date.now()}`;
    const phoneNumber = req.body.phoneNumber || req.query.phoneNumber || "";
    let text = req.body.text || req.query.text || "";

    console.log("USSD Request:", { sessionId, phoneNumber, text });

    let response = "";
    let inputs = text ? text.split("*") : [];

    if (!sessions[sessionId]) {
        sessions[sessionId] = { students: [], parentName: "", parentPhone: "", awaitingStudentClass: false };
    }

    const session = sessions[sessionId];

    if (text === "") {
        response = "CON Welcome to Peak Performance Tutoring!\n1. Register\n2. Fees Info\n3. Contact Us";
    } 
    else if (text === "1") {
        response = "CON Enter Student's Full Name:";
    } 
    else if (session.awaitingStudentClass) {
        // Store student class
        let studentIndex = session.students.length - 1;
        session.students[studentIndex].class = text;
        session.awaitingStudentClass = false;
        response = "CON Add another student?\n1. Yes\n2. No";
    } 
    else if (inputs.length === 2 && inputs[0] === "1") {
        session.students.push({ name: inputs[1], class: "" });
        session.awaitingStudentClass = true;
        response = "CON Enter Student's Class (e.g., Form 1, Form 2, etc.):";
    } 
    else if (inputs.length >= 3 && inputs[inputs.length - 1] === "1") {
        response = "CON Enter Next Student's Full Name:";
    } 
    else if (inputs.length >= 3 && inputs[inputs.length - 1] === "2") {
        response = "CON Enter Parent's Full Name:";
    } 
    else if (inputs.length === 4) {
        session.parentName = inputs[3];
        response = "CON Enter Parent's Phone Number:";
    } 
    else if (inputs.length === 5) {
        session.parentPhone = inputs[4];

        try {
            const { students, parentName, parentPhone } = session;

            // Insert parent into the database
            const [parentResult] = await db.query(
                "INSERT INTO parents (name, phone) VALUES (?, ?)", 
                [parentName, parentPhone]
            );
            const parentId = parentResult.insertId;

            // Bulk insert students
            const studentValues = students.map(student => [parentId, student.name, student.class]);
            await db.query("INSERT INTO students (parent_id, name, class) VALUES ?", [studentValues]);

            delete sessions[sessionId];

            response = "END Registration successful! A confirmation SMS has been sent.";
        } catch (error) {
            console.error("Database Error:", error.message, error.stack);
            response = "END Registration failed. Please try again later.";
        }
    } 
    else if (text === "2") {
        response = "END Our tutoring fees:\n- Primary: KES 5,000/month\n- High School: KES 7,500/month\n- Payment: M-Pesa Paybill 123456 (Acc: Student Name)";
    } 
    else if (text === "3") {
        response = "END Contact Us:\n📞 0798971625\n🌍 www.peakperformance.co.ke";
    } 
    else {
        response = "END Invalid option. Try again.";
    }

    res.set("Content-Type", "text/plain");
    res.send(response);
};

// Routes
app.post("/ussd", processUSSD);

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// Prevent Railway from stopping container unexpectedly
process.on("SIGTERM", () => {
    console.log("Received SIGTERM. Shutting down gracefully...");
    process.exit(0);
});

// Keep server alive for Railway
setInterval(() => console.log("✅ App is running..."), 10000);
