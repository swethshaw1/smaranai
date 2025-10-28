// controllers/subjectController.js

const { supabase } = require("../config/database");
const path = require("path");
const multer = require("multer");
const csv = require("csv-parse");
const fs = require("fs");

// ================================
// Add a subject
// ================================
exports.addSubject = async (req, res) => {
  try {
    const { name, description } = req.body;
    console.log(name, description, "in add subject");

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Subject name is required" });
    }

    const insertObj = {
      name: name.trim(),
      description: description ? description.trim() : null,
      isActive: true,
    };

    const { data, error } = await supabase
      .from("subjects")
      .insert([insertObj])
      .select();

    if (error) throw error;

    const subject = { ...(data && data[0] ? data[0] : {}), modules: [] };

    res.status(201).json({ message: "Subject added successfully", subject });
  } catch (error) {
    res.status(500).json({
      error: "Error adding subject",
      details: error.message || error,
    });
  }
};

// ================================
// Update a subject
// ================================
exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Subject ID is required" });
    }
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Subject name is required" });
    }

    const updateObj = {
      name: name.trim(),
      description: description ? description.trim() : null,
    };

    const { data, error } = await supabase
      .from("subjects")
      .update(updateObj)
      .eq("_id", id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }

    const updatedSubject = { ...data[0] };

    // Fetch modules for this subject (to maintain structure)
    const { data: modulesData, error: modulesErr } = await supabase
      .from("modules")
      .select("*")
      .eq("subjectId", id);

    if (modulesErr) throw modulesErr;
    updatedSubject.modules = modulesData || [];

    res.json({ message: "Subject updated successfully", updatedSubject });
  } catch (error) {
    res.status(500).json({
      error: "Error updating subject",
      details: error.message || error,
    });
  }
};

// ================================
// Toggle Subject active state
// ================================
exports.toggleSubjectActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const { data: subjectData, error: subjectErr } = await supabase
      .from("subjects")
      .select("*")
      .eq("_id", id)
      .single();

    if (subjectErr && subjectErr.code !== "PGRST116") throw subjectErr;
    if (!subjectData) {
      return res.status(404).json({ error: "Subject not found" });
    }

    const { data: updatedSubjects, error: updateErr } = await supabase
      .from("subjects")
      .update({ isActive: Boolean(isActive) })
      .eq("_id", id)
      .select();

    if (updateErr) throw updateErr;

    // Cascade to modules & submodules
    const { data: modules, error: modulesErr } = await supabase
      .from("modules")
      .select("*")
      .eq("subjectId", id);

    if (modulesErr) throw modulesErr;

    const moduleIds = (modules || []).map((m) => m._id);
    if (moduleIds.length > 0) {
      const { error: modUpdErr } = await supabase
        .from("modules")
        .update({ isActive: Boolean(isActive) })
        .in("_id", moduleIds);
      if (modUpdErr) throw modUpdErr;

      const { error: subUpdErr } = await supabase
        .from("submodules")
        .update({ isActive: Boolean(isActive) })
        .in("moduleId", moduleIds);
      if (subUpdErr) throw subUpdErr;
    }

    res.json({
      message: `Subject ${isActive ? "enabled" : "disabled"}`,
      subjectId: id,
      isActive: Boolean(isActive),
    });
  } catch (error) {
    res.status(500).json({
      error: "Error toggling subject",
      details: error.message || error,
    });
  }
};

// ================================
// Add a module
// ================================
exports.addModule = async (req, res) => {
  try {
    const { name, subjectId } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Valid module name is required" });
    }
    if (!subjectId) {
      return res.status(400).json({ error: "Subject ID is required" });
    }

    const { data: subjectExists, error: subjErr } = await supabase
      .from("subjects")
      .select("*")
      .eq("_id", subjectId)
      .single();

    if (subjErr && subjErr.code !== "PGRST116") throw subjErr;
    if (!subjectExists) {
      return res
        .status(404)
        .json({ error: "Subject not found. Please create the subject first." });
    }

    const insertObj = {
      name: name.trim(),
      subjectId,
      isActive: true,
    };

    const { data, error } = await supabase
      .from("modules")
      .insert([insertObj])
      .select();

    if (error) throw error;

    const module = { ...(data && data[0] ? data[0] : {}), subModules: [] };

    const { data: modulesForSubject, error: mfsErr } = await supabase
      .from("modules")
      .select("*")
      .eq("subjectId", subjectId);

    if (mfsErr) throw mfsErr;

    const subjectWithModules = {
      ...subjectExists,
      modules: modulesForSubject || [],
    };

    res.status(201).json({
      message: "Module added successfully",
      module,
      subject: subjectWithModules,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error adding module",
      details: error.message || error,
    });
  }
};

// Toggle Module active state (enable/disable)
exports.toggleModuleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Fetch module
    const { data: moduleData, error: moduleErr } = await supabase
      .from("modules")
      .select("*")
      .eq("_id", id)
      .single();

    if (moduleErr && moduleErr.code !== "PGRST116") throw moduleErr;
    if (!moduleData) return res.status(404).json({ error: "Module not found" });

    // Update module isActive
    const { data: updatedModuleArr, error: updateErr } = await supabase
      .from("modules")
      .update({ isActive: Boolean(isActive) })
      .eq("_id", id)
      .select();

    if (updateErr) throw updateErr;
    const updatedModule =
      updatedModuleArr && updatedModuleArr[0] ? updatedModuleArr[0] : null;

    // Update submodules for this module
    const { error: subUpdErr } = await supabase
      .from("submodules")
      .update({ isActive: Boolean(isActive) })
      .eq("moduleId", id);

    if (subUpdErr) throw subUpdErr;

    res.json({
      message: `Module ${isActive ? "enabled" : "disabled"}`,
      moduleId: id,
      isActive: Boolean(isActive),
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error toggling module", details: error.message || error });
  }
};

// Soft-disable subject instead of permanent delete
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    // Check subject exists
    const { data: subjectData, error: subjErr } = await supabase
      .from("subjects")
      .select("*")
      .eq("_id", id)
      .single();

    if (subjErr && subjErr.code !== "PGRST116") throw subjErr;
    if (!subjectData) return res.status(404).json({ error: "Subject not found" });

    // Soft-disable subject
    const { data: updatedSubj, error: updErr } = await supabase
      .from("subjects")
      .update({ isActive: false })
      .eq("_id", id)
      .select();

    if (updErr) throw updErr;

    // Cascade disable: modules + submodules
    const { data: modules, error: modulesErr } = await supabase
      .from("modules")
      .select("_id")
      .eq("subjectId", id);

    if (modulesErr) throw modulesErr;

    const moduleIds = (modules || []).map((m) => m._id);

    if (moduleIds.length > 0) {
      const { error: modUpdErr } = await supabase
        .from("modules")
        .update({ isActive: false })
        .in("_id", moduleIds);
      if (modUpdErr) throw modUpdErr;

      const { error: subUpdErr } = await supabase
        .from("submodules")
        .update({ isActive: false })
        .in("moduleId", moduleIds);
      if (subUpdErr) throw subUpdErr;
    }

    res.json({ message: "Subject disabled successfully (soft delete)", subjectId: id });
  } catch (error) {
    res.status(500).json({
      error: "Error disabling subject",
      details: error.message || error,
    });
  }
};

// Soft-delete module instead of permanent deletion
exports.deleteModule = async (req, res) => {
  try {
    const { id } = req.params;

    // Check module exists
    const { data: moduleData, error: moduleErr } = await supabase
      .from("modules")
      .select("*")
      .eq("_id", id)
      .single();

    if (moduleErr && moduleErr.code !== "PGRST116") throw moduleErr;
    if (!moduleData) return res.status(404).json({ error: "Module not found" });

    // Soft-disable module
    const { data: updatedModuleArr, error: updErr } = await supabase
      .from("modules")
      .update({ isActive: false })
      .eq("_id", id)
      .select();

    if (updErr) throw updErr;

    // Disable all submodules for this module
    const { error: subUpdErr } = await supabase
      .from("submodules")
      .update({ isActive: false })
      .eq("moduleId", id);

    if (subUpdErr) throw subUpdErr;

    res.json({ message: "Module disabled successfully (soft delete)", moduleId: id });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error disabling module", details: error.message || error });
  }
};

// Add a new SubModule
exports.addSubModule = async (req, res) => {
  try {
    const { name, moduleId, isPro, difficulty } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Submodule name is required" });
    }
    if (!moduleId) {
      return res.status(400).json({ error: "Module ID is required" });
    }

    // Verify module exists
    const { data: moduleData, error: modErr } = await supabase
      .from("modules")
      .select("*")
      .eq("_id", moduleId)
      .single();

    if (modErr && modErr.code !== "PGRST116") throw modErr;
    if (!moduleData) return res.status(404).json({ error: "Module not found" });

    // Insert submodule
    const insertObj = {
      name: name.trim(),
      moduleId,
      isPro: Boolean(isPro),
      difficulty: difficulty || null,
      isActive: true,
    };

    const { data: newSubModule, error: insertErr } = await supabase
      .from("submodules")
      .insert([insertObj])
      .select()
      .single();

    if (insertErr) throw insertErr;

    res.json({ message: "Submodule added successfully", submodule: newSubModule });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error adding submodule", details: error.message || error });
  }
};

// Add a SubModule
exports.addSubModule = async (req, res) => {
  try {
    const { name, moduleId, isPro, difficulty } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Submodule name is required" });
    }
    if (!moduleId) {
      return res.status(400).json({ error: "Module ID is required" });
    }

    // Verify module exists
    const { data: moduleData, error: modErr } = await supabase
      .from("modules")
      .select("*")
      .eq("_id", moduleId)
      .single();

    if (modErr && modErr.code !== "PGRST116") throw modErr;
    if (!moduleData) return res.status(404).json({ error: "Module not found" });

    // Insert submodule
    const insertObj = {
      name: name.trim(),
      moduleId,
      isPro: Boolean(isPro),
      difficulty: difficulty || null,
      isActive: true,
    };

    const { data, error } = await supabase
      .from("submodules")
      .insert([insertObj])
      .select();

    if (error) throw error;

    const subModule = data?.[0] || null;

    res.status(201).json({ message: "Submodule added successfully", subModule });
  } catch (error) {
    res.status(500).json({
      error: "Error adding submodule",
      details: error.message || error,
    });
  }
};

// Toggle SubModule active/inactive
exports.toggleSubModuleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const { data: subMod, error: subErr } = await supabase
      .from("submodules")
      .select("*")
      .eq("_id", id)
      .single();

    if (subErr && subErr.code !== "PGRST116") throw subErr;
    if (!subMod) return res.status(404).json({ error: "Submodule not found" });

    const { data: updatedArr, error: updErr } = await supabase
      .from("submodules")
      .update({ isActive: Boolean(isActive) })
      .eq("_id", id)
      .select();

    if (updErr) throw updErr;

    res.json({
      message: `Submodule ${isActive ? "enabled" : "disabled"}`,
      subModuleId: id,
      isActive: Boolean(isActive),
    });
  } catch (error) {
    res.status(500).json({
      error: "Error toggling submodule",
      details: error.message || error,
    });
  }
};

// Add a Question
exports.addQuestion = async (req, res) => {
  try {
    const {
      questionText,
      questionType,
      options,
      correctAnswer,
      blanks,
      leftItems,
      rightItems,
      correctMappings,
      submoduleId,
    } = req.body;

    if (!questionText || questionText.trim() === "") {
      return res.status(400).json({ error: "Question text is required" });
    }

    // Validate questionType
    const validTypes = ["mcq", "truefalse", "fillblanks", "matchfollowing"];
    const type = validTypes.includes(questionType) ? questionType : "mcq";

    const insertObj = {
      submoduleId,
      questionText: questionText.trim(),
      questionType: type,
      options: options || null,
      correctAnswer: correctAnswer ?? null,
      blanks: blanks || null,
      leftItems: leftItems || null,
      rightItems: rightItems || null,
      correctMappings: correctMappings || null,
    };

    const { data, error } = await supabase.from("questions").insert([insertObj]).select();

    if (error) throw error;

    const question = data?.[0] || null;

    res.status(201).json({ message: "Question added successfully", question });
  } catch (error) {
    res.status(500).json({
      error: "Error adding question",
      details: error.message || error,
    });
  }
};

// Update Question
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      questionText,
      questionType,
      options,
      correctAnswer,
      blanks,
      leftItems,
      rightItems,
      correctMappings,
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Question ID is required" });
    }

    const validTypes = ["mcq", "truefalse", "fillblanks", "matchfollowing"];
    const type = validTypes.includes(questionType) ? questionType : "mcq";

    const updateObj = {
      questionText: questionText?.trim(),
      questionType: type,
      options: options || null,
      correctAnswer: correctAnswer ?? null,
      blanks: blanks || null,
      leftItems: leftItems || null,
      rightItems: rightItems || null,
      correctMappings: correctMappings || null,
    };

    const { data, error } = await supabase
      .from("questions")
      .update(updateObj)
      .eq("_id", id)
      .select();

    if (error) throw error;

    if (!data?.length) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({ message: "Question updated successfully", question: data[0] });
  } catch (error) {
    res.status(500).json({
      error: "Error updating question",
      details: error.message || error,
    });
  }
};

// Delete Question
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase.from("questions").delete().eq("_id", id).select();

    if (error) throw error;
    if (!data?.length) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({ message: "Question deleted successfully", questionId: id });
  } catch (error) {
    res.status(500).json({
      error: "Error deleting question",
      details: error.message || error,
    });
  }
};

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = ["application/json", "text/csv"].includes(file.mimetype);
    cb(ok ? null : new Error("Only JSON or CSV allowed"), ok);
  },
}).single("file");

// Helper: Process JSON Question File
async function processJSONFile(filePath, submoduleId) {
  const raw = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
  if (!Array.isArray(raw.questions)) throw new Error("Invalid JSON: missing questions array");

  const validTypes = ["mcq", "truefalse", "fillblanks", "matchfollowing"];
  const insertedIds = [];

  for (const q of raw.questions) {
    const type = validTypes.includes(q.questionType) ? q.questionType : "mcq";

    const qObj = {
      submoduleId,
      questionText: q.questionText,
      questionType: type,
      options: q.options || null,
      correctAnswer: q.correctAnswer ?? null,
      blanks: q.blanks || null,
      leftItems: q.leftItems || null,
      rightItems: q.rightItems || null,
      correctMappings: q.correctMappings || null,
    };

    const { data, error } = await supabase.from("questions").insert([qObj]).select();
    if (error) throw error;
    if (data?.[0]) insertedIds.push(data[0]._id);
  }

  await supabase.from("submodules").update({ questions: insertedIds }).eq("_id", submoduleId);
  return insertedIds;
}

// Helper: Process CSV Question File
async function processCSVFile(filePath, submoduleId) {
  const records = await new Promise((resolve, reject) => {
    const out = [];
    fs.createReadStream(filePath)
      .pipe(csv.parse({ columns: true, delimiter: "," }))
      .on("data", (r) => out.push(r))
      .on("end", () => resolve(out))
      .on("error", reject);
  });

  const insertedIds = [];

  for (const r of records) {
    const type = (r.questionType || "mcq").toLowerCase();
    const qObj = { submoduleId, questionText: r.questionText, questionType: type };

    switch (type) {
      case "mcq":
        qObj.options = Array.from({ length: 4 }, (_, i) => {
          const text = r[`option${i + 1}`];
          return text
            ? {
                optionText: text.trim(),
                isCorrect: r[`isCorrect${i + 1}`]?.toLowerCase() === "true",
              }
            : null;
        }).filter(Boolean);
        break;

      case "truefalse":
        qObj.correctAnswer = r.correctAnswer?.toLowerCase() === "true";
        break;

      case "fillblanks":
        qObj.blanks = Array.from({ length: 5 }, (_, i) => r[`blank${i + 1}`])
          .filter(Boolean)
          .map((b) => b.trim());
        break;

      case "matchfollowing":
        qObj.leftItems = Array.from({ length: 5 }, (_, i) => r[`leftItem${i + 1}`])
          .filter(Boolean)
          .map((x) => x.trim());
        qObj.rightItems = Array.from({ length: 5 }, (_, i) => r[`rightItem${i + 1}`])
          .filter(Boolean)
          .map((x) => x.trim());
        if (r.correctMappings) {
          qObj.correctMappings = r.correctMappings.split(",").map((m) => {
            const [l, ri] = m.split(":");
            return { leftIndex: +l, rightIndex: +ri };
          });
        }
        break;
    }

    const { data, error } = await supabase.from("questions").insert([qObj]).select();
    if (error) throw error;
    if (data?.[0]) insertedIds.push(data[0]._id);
  }

  await supabase.from("submodules").update({ questions: insertedIds }).eq("_id", submoduleId);
  return insertedIds;
}

// Create Submodule + Upload Questions File
exports.createSubmoduleWithQuestions = async (req, res) => {
  try {
    await new Promise((resolve, reject) => upload(req, res, (err) => (err ? reject(err) : resolve())));

    if (!req.file) throw new Error("Question file is required");

    const { name, moduleId, difficulty } = req.body;
    const isPro = req.body.isPro === "true";

    if (!name || !moduleId || !difficulty)
      throw new Error("Missing required fields");

    // Verify module exists
    const { data: modData, error: modErr } = await supabase
      .from("modules")
      .select("*")
      .eq("_id", moduleId)
      .single();

    if (modErr && modErr.code !== "PGRST116") throw modErr;
    if (!modData) throw new Error("Module not found");

    // Create submodule
    const subObj = { name: name.trim(), moduleId, difficulty, isPro, isActive: true };
    const { data: subData, error: subErr } = await supabase
      .from("submodules")
      .insert([subObj])
      .select();

    if (subErr) throw subErr;
    const submodule = subData[0];

    // Process question file
    const inserted =
      req.file.mimetype === "application/json"
        ? await processJSONFile(req.file.path, submodule._id)
        : await processCSVFile(req.file.path, submodule._id);

    // Cleanup temp file
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      message: "Submodule created successfully with questions",
      submodule,
      questionsCount: inserted.length,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({
      error: "Failed to create submodule with questions",
      details: error.message || error,
    });
  }
};

// Get Submodule + Questions
exports.getSubmoduleQuestions = async (req, res) => {
  try {
    const { submoduleId } = req.params;

    const { data: subData, error } = await supabase
      .from("submodules")
      .select("*, questions(*)")
      .eq("_id", submoduleId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    if (!subData) return res.status(404).json({ error: "Submodule not found" });

    res.json({
      submodule: {
        name: subData.name,
        difficulty: subData.difficulty,
        isPro: subData.isPro,
        questions: subData.questions || [],
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Error fetching submodule questions",
      details: error.message || error,
    });
  }
};
