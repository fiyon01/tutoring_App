const express = require("express");
const bodyParser = require("body-parser");
const db = require("./config/db");

const app = express();

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const sessions = {};

// Function to process USSD requests
const processUSSD = async (req, res) => {
    // Extract parameters safely
    const sessionId = req.body.sessionId || req.query.sessionId || "";
    const phoneNumber = req.body.phoneNumber || req.query.phoneNumber || "";
    let text = req.body.text || req.query.text || "";

    // Debugging Log
    console.log("USSD Request:", { sessionId, phoneNumber, text });

    let response = "";
    let inputs = text ? text.split("*") : [];

    // Validate sessionId
    if (!sessionId) {
        console.error("ERROR: Missing sessionId!");
        return res.status(400).send("END Invalid request. Missing sessionId.");
    }

    // Initialize session
    if (!sessions[sessionId]) {
        sessions[sessionId] = { students: [], parentName: "", parentPhone: "" };
    }

    // USSD Menu Logic
    if (text === "") {
        response = "CON Welcome to Peak Performance Tutoring!\n1. Register\n2. Fees Info\n3. Contact Us";
    } else if (text === "1") {
        response = "CON Enter Student's Full Name:";
    } else if (inputs.length === 2 && inputs[0] === "1") {
        sessions[sessionId].students.push({ name: inputs[1], class: "" });
        response = "CON Enter Student's Class (e.g., Form 1, Form 2, etc.):";
    } else if (inputs.length === 3) {
        let studentIndex = sessions[sessionId].students.length - 1;
        sessions[sessionId].students[studentIndex].class = inputs[2];
        response = "CON Add another student?\n1. Yes\n2. No";
    } else if (inputs.length === 4 && inputs[3] === "1") {
        response = "CON Enter Next Student's Full Name:";
    } else if (inputs.length === 4 && inputs[3] === "2") {
        response = "CON Enter Parent's Full Name:";
    } else if (inputs.length === 5) {
        sessions[sessionId].parentName = inputs[4];
        response = "CON Enter Parent's Phone Number:";
    } else if (inputs.length === 6) {
        sessions[sessionId].parentPhone = inputs[5];

        try {
            const { students, parentName, parentPhone } = sessions[sessionId];

            // Insert parent into the database
            const [parentResult] = await db.query(
                "INSERT INTO parents (name, phone) VALUES (?, ?)", 
                [parentName, parentPhone]
            );
            const parentId = parentResult.insertId;

            // Bulk insert students
            const studentValues = students.map(student => [parentId, student.name, student.class]);
            await db.query("INSERT INTO students (parent_id, name, class) VALUES ?", [studentValues]);

            // Clear session
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
        response = "END Contact Us:\n📞 0712 345 678\n📧 support@peakperformance.co.ke\n🌍 www.peakperformance.co.ke";
    } 
    else {
        response = "END Invalid option. Try again.";
    }

    res.set("Content-Type", "text/plain");
    res.send(response);
};

// Routes
app.get("/ussd", processUSSD);
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
