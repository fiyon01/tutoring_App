const express = require("express");
const db = require("./config/db"); // Database connection
const app = express();

app.use(express.json()); // Middleware to parse JSON
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data (important for USSD)

const sessions = {}; // Initialize session storage

app.get("/", (req, res) => {
    res.send("Hello");
});

app.post("/ussd", async (req, res) => {
    const { sessionId, phoneNumber, text } = req.body;
    let response = "";
    let inputs = text.split("*");

    if (!sessions[sessionId]) {
        sessions[sessionId] = { students: [], parentName: "", parentPhone: "" };
    }

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

            // Send Confirmation SMS (Uncomment & Implement sendSMS function)
            // let studentList = students.map(s => `${s.name} (${s.class})`).join(", ");
            // const message = `Hello ${parentName}, your children ${studentList} have been successfully registered for Peak Performance Tutoring.`;
            // await sendSMS(parentPhone, message);

            // Clear session
            delete sessions[sessionId];

            response = "END Registration successful! A confirmation SMS has been sent.";
        } catch (error) {
            console.error("Database Error:", error);
            response = "END Registration failed. Please try again later.";
        }
    } else {
        response = "END Invalid option. Try again.";
    }

    res.set("Content-Type", "text/plain");
    res.send(response);
});

app.listen(3500, () => {
    console.log("Server running on port 3500");
});
