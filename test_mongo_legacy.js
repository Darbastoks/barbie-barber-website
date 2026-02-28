const mongoose = require('mongoose');
const uri = "mongodb://admin:2EzPxD6BwTHr@ac-kmhyorg-shard-00-00.dstbasd.mongodb.net:27017,ac-kmhyorg-shard-00-01.dstbasd.mongodb.net:27017,ac-kmhyorg-shard-00-02.dstbasd.mongodb.net:27017/barbie_barber?ssl=true&replicaSet=atlas-ya7eok-shard-0&authSource=admin&retryWrites=true&w=majority&appName=admin";

console.log("Attempting legacy connection with new password...");
mongoose.connect(uri)
    .then(() => {
        console.log("✅ Legacy Connected");
        process.exit(0);
    })
    .catch(e => {
        console.error("❌ Legacy Failed:", e.message);
        process.exit(1);
    });
