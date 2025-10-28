const express = require("express");
const userController = require("../controllers/userControllers");
const router = express.Router();

router.get("/submodules/:id", userController.getSubmoduleQuestions);
router.post("/questions/:id/attempt", userController.submitAnswer);
router.put("/questions/:id/note", userController.addNote);
router.put("/questions/:id/tag", userController.addTag);
router.get("/analytics", userController.getAnalyticsData);
router.get("/attempted-submodule", userController.getAttemptedSubModules);

router.post("/submit-analytics", userController.submitAnalytics);
router.post("/reset-quiz", userController.resetQuiz);
module.exports = router;