const { supabase } = require("../config/database");

/**
 * Get all subjects for the dashboard with optional search.
 */
exports.getSubjects = async (req, res) => {
  try {
    const { search, includeDisabled } = req.query;
    const showAll = includeDisabled === "1" || includeDisabled === "true";

    let query = supabase.from("subjects").select("*");

    if (!showAll) query = query.or("isActive.eq.true,isActive.is.null");
    if (search)
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

    query = query.order("name", { ascending: true });

    const { data: subjects, error } = await query;
    if (error) throw error;

    res.json({
      subjects,
      totalSubjects: subjects.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch subjects",
      details: error.message,
    });
  }
};

/**
 * Get all submodules for a given module.
 */
exports.getSubModules = async (req, res) => {
  try {
    const { key } = req.params;
    const { includeDisabled } = req.query;
    const showAll = includeDisabled === "1" || includeDisabled === "true";

    if (!key) {
      return res.status(400).json({ error: "Valid key is required" });
    }

    let query = supabase.from("submodules").select("*").eq("moduleId", key);
    if (!showAll) query = query.or("isActive.eq.true,isActive.is.null");

    const { data: subModules, error } = await query;
    if (error) throw error;

    if (!subModules || subModules.length === 0)
      return res.status(404).json({ error: "No submodules for this module" });

    res.json({
      subModules,
      totalSubModules: subModules.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch submodules",
      details: error.message,
    });
  }
};

/**
 * Get modules and submodules under a specific subject name.
 */
exports.getModulesAndSubModules = async (req, res) => {
  try {
    const { subjectName } = req.params;
    const { includeDisabled } = req.query;
    const showAll = includeDisabled === "1" || includeDisabled === "true";

    if (!subjectName || typeof subjectName !== "string") {
      return res.status(400).json({ error: "Valid subject name is required" });
    }

    // Find subject by name
    const { data: subject, error: subjError } = await supabase
      .from("subjects")
      .select("*")
      .ilike("name", subjectName)
      .maybeSingle();

    if (subjError) throw subjError;
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    // Fetch modules for the subject
    let modQuery = supabase
      .from("modules")
      .select("*")
      .eq("subjectId", subject._id);

    if (!showAll) modQuery = modQuery.or("isActive.eq.true,isActive.is.null");

    const { data: modules, error: modErr } = await modQuery;
    if (modErr) throw modErr;

    // Attach submodules with question counts
    const modulesWithSubModules = await Promise.all(
      modules.map(async (mod) => {
        let subQuery = supabase
          .from("submodules")
          .select("*")
          .eq("moduleId", mod._id);

        if (!showAll)
          subQuery = subQuery.or("isActive.eq.true,isActive.is.null");

        const { data: subModules, error: subErr } = await subQuery;
        if (subErr) throw subErr;

        const subModulesWithCounts = await Promise.all(
          subModules.map(async (sub) => {
            const { count, error: qErr } = await supabase
              .from("questions")
              .select("*", { count: "exact", head: true })
              .eq("submoduleId", sub._id);

            if (qErr) throw qErr;

            return {
              id: sub._id,
              name: sub.name,
              isPro: sub.isPro,
              difficulty: sub.difficulty,
              questionCount: count || 0,
            };
          })
        );

        return {
          id: mod._id,
          name: mod.name,
          isActive: mod.isActive,
          subModules: subModulesWithCounts,
          totalSubModules: subModulesWithCounts.length,
        };
      })
    );

    res.json({
      subject: {
        id: subject._id,
        name: subject.name,
        description: subject.description,
      },
      modules: modulesWithSubModules,
      totalModules: modules.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch modules and submodules",
      details: error.message,
    });
  }
};

/**
 * Get questions for a specific submodule with pagination.
 */
exports.getQuestions = async (req, res) => {
  try {
    const { subjectName, subModuleId } = req.params;
    const { difficulty, lastQuestionId, limit = 10 } = req.query;

    // Get subject
    const { data: subject, error: subjErr } = await supabase
      .from("subjects")
      .select("*")
      .ilike("name", subjectName)
      .maybeSingle();

    if (subjErr) throw subjErr;
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    // Validate submodule
    const { data: subModule, error: subErr } = await supabase
      .from("submodules")
      .select("*")
      .eq("_id", subModuleId)
      .maybeSingle();

    if (subErr) throw subErr;
    if (!subModule)
      return res.status(404).json({ error: "Submodule not found" });

    // Validate submodule relationship
    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("*")
      .eq("_id", subModule.moduleId)
      .eq("subjectId", subject._id)
      .maybeSingle();

    if (modErr) throw modErr;
    if (!mod)
      return res
        .status(404)
        .json({ error: "Submodule does not belong to subject" });

    // Query questions
    let query = supabase
      .from("questions")
      .select("questionText, options, _id")
      .eq("submoduleId", subModuleId)
      .order("_id", { ascending: true })
      .limit(parseInt(limit) + 1);

    if (difficulty) query = query.eq("difficulty", difficulty.toLowerCase());
    if (lastQuestionId) query = query.gt("_id", lastQuestionId);

    const { data: questions, error: qErr } = await query;
    if (qErr) throw qErr;

    const hasMore = questions.length > limit;
    const finalQuestions = questions.slice(0, limit);
    const nextCursor = hasMore ? finalQuestions.at(-1)._id : null;

    // Count total questions
    const { count: totalQuestions, error: countErr } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("submoduleId", subModuleId);

    if (countErr) throw countErr;

    res.json({
      subModule: {
        id: subModule._id,
        name: subModule.name,
        isPro: subModule.isPro,
      },
      questions: finalQuestions,
      pagination: {
        hasMore,
        nextCursor,
        totalQuestions,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch questions",
      details: error.message,
    });
  }
};
