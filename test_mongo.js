const mongoose = require('mongoose');
const uri = "mongodb+srv://Velora:pnzgxRHiSWPZkCAP@cluster0.uvfulm0.mongodb.net/barbie_barber?retryWrites=true&w=majority&appName=Cluster0";

console.log("Attempting standard connection...");
mongoose.connect(uri)
    .then(() => {
        console.log("✅ Standard Connected");
        process.exit(0);
    })
    .catch(e => {
        console.error("❌ Standard Failed:", e.message);
        console.log("Attempting IPv4 connection...");
        mongoose.connect(uri, { family: 4 })
            .then(() => {
                console.log("✅ IPv4 Connected");
                process.exit(0);
            })
            .catch(e2 => {
                console.error("❌ IPv4 Failed:", e2.message);
                process.exit(1);
            });
    });
