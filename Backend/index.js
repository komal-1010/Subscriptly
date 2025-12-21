import dotenv from "dotenv";
import app from './src/app.js'
import initDatabase from "./db/init.js";
dotenv.config()
const PORT = process.env.PORT || 3000;

async function startServer() {
    await initDatabase(); // ensure DB exists
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
