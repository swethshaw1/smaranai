const express = require("express");
const adminController = require("../controllers/adminControllers");
const router = express.Router();

// ---------------- Subjects ----------------
router.post("/subjects", adminController.addSubject);
router.put("/subjects/:id", adminController.updateSubject);
// router.delete("/subjects/:id", adminController.deleteSubject);
router.patch("/subjects/:id/toggle", adminController.toggleSubjectActive);

// ---------------- Modules ----------------
router.post("/modules", adminController.addModule);
// router.delete("/modules/:id", adminController.deleteModule);
router.patch("/modules/:id/toggle", adminController.toggleModuleActive);

// ---------------- SubModules ----------------
router.post("/sub-modules", adminController.addSubModule);
// router.delete("/sub-modules/:id", adminController.deleteSubModule);
router.patch("/sub-modules/:id/toggle", adminController.toggleSubModuleActive);

// ---------------- Questions ----------------
router.post("/questions", adminController.addQuestion);
router.put("/questions/:id", adminController.updateQuestion);
// router.delete("/questions/:id", adminController.deleteQuestion);

// ---------------- Upload Submodule (Excel / File) ----------------
router.post("/submodules/upload", adminController.createSubmoduleWithQuestions);

// ---------------- Get Questions for a Submodule ----------------
router.get("/submodules/:submoduleId", adminController.getSubmoduleQuestions);

module.exports = router;
