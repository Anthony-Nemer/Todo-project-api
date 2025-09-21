import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// 1) CORS (list ALL origins you serve the frontend from)
const allowedOrigins = [
  "https://Anthony-Nemer.github.io",
  "https://Anthony-Nemer.github.io/Todo-project-api", // if hosted under a path
  "https://bebywebsitetodo.space"
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  }
}));

// 2) Handle OPTIONS preflight for all routes
app.options("*", cors());

// 3) Body parser
app.use(express.json());

// 4) Public endpoints BEFORE auth
app.get("/", (_req, res) => res.json({ ok: true, service: "todo-api" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

// 5) Optional auth middleware for everything else
const API_TOKEN = process.env.API_TOKEN;
app.use((req, res, next) => {
  // Let health & root through
  if (req.path === "/" || req.path === "/health") return next();

  if (!API_TOKEN) return next(); // auth disabled

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token !== API_TOKEN) return res.status(401).json({ message: "Unauthorized" });
  next();
})

// Mongo connect
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("Missing MONGO_URI");
  process.exit(1);
}
await mongoose.connect(MONGO_URI);

// Model
const Task = mongoose.model("Task", new mongoose.Schema(
  {
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
));

// Routes
app.get("/health", (_req, res) => res.json({ ok: true }));

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
    {
      ...(text !== undefined && { text }),
      ...(completed !== undefined && { completed }),
    },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: "not found" });
  res.json(updated);
});

app.delete("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const ok = await Task.findByIdAndDelete(id);
  if (!ok) return res.status(404).json({ message: "not found" });
  res.status(204).end();
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API listening on ${port}`));
