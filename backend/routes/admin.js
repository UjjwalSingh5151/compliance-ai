import { Router } from "express";
import { supabaseAdmin, requireAdmin } from "../lib/shared.js";

const router = Router();

router.get("/schools", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("schools").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ schools: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/schools/:id", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const { data, error } = await supabaseAdmin
      .from("schools").update({ status }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ school: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
