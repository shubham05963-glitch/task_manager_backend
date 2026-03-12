import { Router } from "express";
import { auth, AuthRequest } from "../middleware/auth";
import { NewTask, tasks } from "../db/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

const taskRouter = Router();


// CREATE TASK
taskRouter.post("/", auth, async (req: AuthRequest, res) => {
  try {

    if (!req.body.title || !req.body.description || !req.body.dueAt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newTask: NewTask = {
      ...req.body,
      dueAt: new Date(req.body.dueAt),
      uid: req.user
    };

    const [task] = await db
      .insert(tasks)
      .values(newTask)
      .returning();

    return res.status(201).json(task);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to create task" });
  }
});


// GET ALL TASKS
taskRouter.get("/", auth, async (req: AuthRequest, res) => {
  try {

    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.uid, req.user!));

    return res.json(allTasks);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});


// UPDATE TASK
taskRouter.put("/:taskId", auth, async (req: AuthRequest, res) => {
  try {

    const { taskId } = req.params;

    const updatedTask = {
      ...req.body,
      dueAt: new Date(req.body.dueAt),
      updatedAt: new Date()
    };

    const [task] = await db
      .update(tasks)
      .set(updatedTask)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.uid, req.user!)
        )
      )
      .returning();

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.json(task);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to update task" });
  }
});


// DELETE TASK
taskRouter.delete("/:taskId", auth, async (req: AuthRequest, res) => {
  try {

    const { taskId } = req.params;

    await db
      .delete(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.uid, req.user!)
        )
      );

    return res.json({ success: true });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to delete task" });
  }
});


// SYNC TASKS (OFFLINE SUPPORT)
taskRouter.post("/sync", auth, async (req: AuthRequest, res) => {
  try {

    const tasksList = req.body;

    if (!Array.isArray(tasksList)) {
      return res.status(400).json({ error: "Invalid task list" });
    }

    const filteredTasks: NewTask[] = [];

    for (let t of tasksList) {
      filteredTasks.push({
        ...t,
        dueAt: new Date(t.dueAt),
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
        uid: req.user
      });
    }

    const pushedTasks = await db
      .insert(tasks)
      .values(filteredTasks)
      .onConflictDoNothing()   // prevents duplicate tasks
      .returning();

    return res.status(201).json(pushedTasks);

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to sync tasks" });
  }
});

export default taskRouter;

