const { supabase } = require("../config/database");

// ======================================================
// RESET QUIZ
// ======================================================
exports.resetQuiz = async (req, res) => {
  try {
    const { googleId, subModuleId } = req.body.data;
    console.log("Received:", { googleId, subModuleId });

    if (!googleId || !subModuleId)
      return res.status(400).json({ message: "Missing googleId or subModuleId" });

    const { data, error } = await supabase
      .from("analytics")
      .delete()
      .match({ googleId, submoduleId: subModuleId });

    if (error) throw error;

    if (data.length === 0)
      return res.status(404).json({ message: "No analytics found to delete" });

    res.status(200).json({ message: "Quiz data reset successfully" });
  } catch (error) {
    console.error("Error resetting quiz:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ======================================================
// GET ATTEMPTED SUBMODULES
// ======================================================
exports.getAttemptedSubModules = async (req, res) => {
  try {
    const { googleId, subjectId } = req.query;

    if (!googleId || !subjectId)
      return res.status(400).json({ message: "Missing googleId or subjectId" });

    const { data, error } = await supabase
      .from("analytics")
      .select("submoduleId")
      .eq("googleId", googleId)
      .eq("subjectId", subjectId);

    if (error) throw error;

    const attemptedSubmodules = data.map((row) => row.submoduleId);
    res.status(200).json({ attemptedSubmodules });
  } catch (error) {
    console.error("Error fetching attempted submodules:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// ======================================================
// GET ANALYTICS DATA
// ======================================================
exports.getAnalyticsData = async (req, res) => {
  try {
    const { googleId, subModuleId } = req.query;

    if (!googleId)
      return res.status(400).json({ message: "Missing googleId" });

    let query = supabase.from("analytics").select("*").eq("googleId", googleId);

    if (subModuleId) query = query.eq("submoduleId", subModuleId);

    const { data: analyticsRecords, error } = await query.order("updatedAt", { ascending: true });

    if (error) throw error;
    if (!analyticsRecords || analyticsRecords.length === 0)
      return res.status(404).json({ message: "No analytics data found" });

    let totalCorrectAnswers = 0,
      totalIncorrectAnswers = 0,
      totalTimeSpent = 0,
      totalQuestions = 0,
      bestScore = 0,
      totalQuizzes = analyticsRecords.length;

    const ok = [], bad = [], important = [], common = [];
    const timeline = [];
    const activityMap = new Map();
    const today = new Date();
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);

    analyticsRecords.forEach((record) => {
      const { correctAnswers, incorrectAnswers, totalTimeSpent: recordTime, questionAnswers, updatedAt } = record;

      const questions = Array.isArray(questionAnswers) ? questionAnswers : JSON.parse(questionAnswers || "[]");

      totalCorrectAnswers += correctAnswers || 0;
      totalIncorrectAnswers += incorrectAnswers || 0;
      totalTimeSpent += recordTime || 0;
      totalQuestions += questions.length;

      const quizScore = questions.length ? Math.round((correctAnswers / questions.length) * 100) : 0;
      if (quizScore > bestScore) bestScore = quizScore;

      const quizDate = new Date(updatedAt);
      const dateLabel = quizDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      timeline.push({
        label: dateLabel,
        score: quizScore,
        accuracy:
          correctAnswers + incorrectAnswers > 0
            ? Math.round((correctAnswers / (correctAnswers + incorrectAnswers)) * 100)
            : 0,
        date: updatedAt,
      });

      if (quizDate >= fourteenDaysAgo) {
        const key = dateLabel;
        activityMap.set(key, (activityMap.get(key) || 0) + 1);
      }

      questions.forEach((qa) => {
        const { questionId, tag, notes } = qa;
        if (tag === "ok") ok.push({ questionId, notes });
        else if (tag === "bad") bad.push({ questionId, notes });
        else if (tag === "important") important.push({ questionId, notes });
        if (notes) common.push({ questionId, notes });
      });
    });

    const activity = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      activity.push({ day: key, count: activityMap.get(key) || 0 });
    }

    res.json({
      responseData: {
        stats: {
          totalQuestions,
          correctAnswers: totalCorrectAnswers,
          incorrectAnswers: totalIncorrectAnswers,
          totalTimeSpent,
          totalQuizzes,
          bestScore,
        },
        questionClassification: { ok, bad, important, common },
        timeline,
        activity,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// ======================================================
// SUBMIT ANALYTICS
// ======================================================
exports.submitAnalytics = async (req, res) => {
  try {
    const {
      googleId,
      subjectId,
      subModuleId,
      tagCounts,
      questionAnswers,
      totalTimeSpent,
      correctAnswers,
      incorrectAnswers,
      progress,
    } = req.body;

    if (!googleId || !subModuleId || !subjectId || !questionAnswers)
      return res.status(400).json({ message: "Missing required fields" });

    const { data, error } = await supabase.from("analytics").insert([
      {
        googleId,
        subjectId,
        submoduleId: subModuleId,
        tagCounts,
        questionAnswers,
        totalTimeSpent,
        correctAnswers,
        incorrectAnswers,
        progress,
        updatedAt: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    res.status(200).json({ message: "Analytics data submitted successfully", data });
  } catch (error) {
    console.error("Error submitting analytics:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


// ======================================================
// GET SUBMODULE QUESTIONS
// ======================================================
exports.getSubmoduleQuestions = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("submoduleId", id);

    if (error) throw error;
    if (!data || data.length === 0)
      return res.status(404).json({ error: "No questions found for this submodule" });

    res.json({ questions: data });
  } catch (error) {
    res.status(500).json({ error: "Error fetching questions", details: error.message });
  }
};

// ======================================================
// SUBMIT ANSWER
// ======================================================
exports.submitAnswer = async (req, res) => {
  try {
    const { id } = req.params;
    const { googleId, subModuleId, userAnswer } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from("analytics")
      .select("questionAnswers")
      .eq("googleId", googleId)
      .eq("submoduleId", subModuleId)
      .single();

    if (fetchErr && fetchErr.code !== "PGRST116") throw fetchErr;

    let answers = existing?.questionAnswers || [];
    const idx = answers.findIndex((q) => q.questionId === id);

    if (idx >= 0) answers[idx].userAnswer = userAnswer;
    else answers.push({ questionId: id, userAnswer });

    const { error } = await supabase
      .from("analytics")
      .update({ questionAnswers: answers })
      .eq("googleId", googleId)
      .eq("submoduleId", subModuleId);

    if (error) throw error;

    res.json({ message: "Answer submitted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error submitting answer", details: error.message });
  }
};


// ======================================================
// ADD NOTE
// ======================================================
exports.addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { googleId, subModuleId, note } = req.body;

    const { data, error } = await supabase
      .from("analytics")
      .select("questionAnswers")
      .eq("googleId", googleId)
      .eq("submoduleId", subModuleId)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Analytics record not found" });

    let answers = data.questionAnswers || [];
    const q = answers.find((a) => a.questionId === id);
    if (!q) return res.status(404).json({ error: "Question not found in analytics" });

    q.notes = note;

    const { error: updateErr } = await supabase
      .from("analytics")
      .update({ questionAnswers: answers })
      .eq("googleId", googleId)
      .eq("submoduleId", subModuleId);

    if (updateErr) throw updateErr;
    res.json({ message: "Note added successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error adding note", details: error.message });
  }
};


// ======================================================
// ADD TAG
// ======================================================
exports.addTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { googleId, subModuleId, tag } = req.body;

    const { data, error } = await supabase
      .from("analytics")
      .select("questionAnswers")
      .eq("googleId", googleId)
      .eq("submoduleId", subModuleId)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Analytics record not found" });

    let answers = data.questionAnswers || [];
    const q = answers.find((a) => a.questionId === id);
    if (!q) return res.status(404).json({ error: "Question not found in analytics" });

    q.tag = tag;

    const { error: updateErr } = await supabase
      .from("analytics")
      .update({ questionAnswers: answers })
      .eq("googleId", googleId)
      .eq("submoduleId", subModuleId);

    if (updateErr) throw updateErr;
    res.json({ message: "Tag added successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error adding tag", details: error.message });
  }
};
