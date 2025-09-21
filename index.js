import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

/* ===== CORS (list your frontend origins) ===== */
const allowedOrigins = [
  "https://anthony-nemer.github.io",
  "https://bebywebsitetodo.space",
];
const corsOptions = {
  origin(origin, cb) {
    // allow same-origin tools (curl/Postman) with no Origin header
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};

app.use(cors(corsOptions));
// ✅ Express 5 fix: use RegExp instead of "*"
app.options(/.*/, cors(corsOptions));

app.use(express.json());

/* ===== Public endpoints ===== */
app.get("/", (_req, res) => res.json({ ok: true, service: "todo-api" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ===== Optional bearer-token auth for everything else ===== */
const API_TOKEN = process.env.API_TOKEN;
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/health") return next();
  if (!API_TOKEN) return next(); // auth disabled

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token !== API_TOKEN) return res.status(401).json({ message: "Unauthorized" });
  next();
});

/* ===== Mongo connect ===== */
const rawUri = process.env.MONGO_URI;
if (!rawUri || !/^mongodb(\+srv)?:\/\//i.test(rawUri)) {
  console.error("❌ MONGO_URI missing/invalid. Must start with mongodb:// or mongodb+srv://");
  process.exit(1);
}
const safeUri = rawUri.replace(/\/\/.*@/, "//<redacted>@");
console.log("✅ Using MONGO_URI:", safeUri);

await mongoose.connect(rawUri, { serverSelectionTimeoutMS: 10000, family: 4 });

/* ===== Model ===== */
const Task = mongoose.model(
  "Task",
  new mongoose.Schema(
    { text: { type: String, required: true }, completed: { type: Boolean, default: false } },
    { timestamps: true }
  )
);

/* ===== Routes ===== */
app.get("/tasks", async (_req, res) => {
  const tasks = await Task.find().sort({ createdAt: 1 });
  res.json(tasks);
});

app.post("/tasks", async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ message: "text required" });
  const created = await Task.create({ text, completed: false });
  res.status(201).json(created);
});

app.patch("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { text, completed } = req.body;
  const updated = await Task.findByIdAndUpdate(
    id,
    { ...(text !== undefined && { text }), ...(completed !== undefined && { completed }) },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: "not found" });
  res.json(updated);
});

app.delete("/tasks/:id", async (req, res) => {
  const ok = await Task.findByIdAndDelete(req.params.id);
  if (!ok) return res.status(404).json({ message: "not found" });
  res.status(204).end();
});

/* ===== Start ===== */
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API listening on ${port}`));
