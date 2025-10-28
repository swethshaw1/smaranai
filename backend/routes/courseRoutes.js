// courseRoutes.js
const express = require("express");
const {
  getSubjects,
  getModulesAndSubModules,
  getQuestions,
  getSubModules,
} = require("../controllers/courseControllers");

const router = express.Router();

/**
 * @route GET /api/dashboard
 * @description Get all subjects with pagination and search
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 * @query {string} search - Search term for subject name or description
 */
router.get("/dashboard", getSubjects);

/**
 * @route GET /api/courses/:subjectName
 * @description Get all modules and submodules for a subject
 * @param {string} subjectName - Name of the subject
 */
router.get("/courses/:subjectName", getModulesAndSubModules);

/**
 * @route GET /api/modules/submodules/:key
 * @description Get all submodules under a module by key or ID
 * @param {string} key - Module key or ID
 */
router.get("/modules/submodules/:key", getSubModules);

/**
 * @route GET /api/courses/:subjectName/:subModuleId
 * @description Get questions for a specific submodule
 * @param {string} subjectName - Name of the subject
 * @param {string} subModuleId - ID of the submodule
 * @query {string} difficulty - (optional) Filter by difficulty (easy, medium, hard)
 * @query {number} page - (optional) Page number (default: 1)
 * @query {number} limit - (optional) Items per page (default: 10)
 */
router.get("/courses/:subjectName/:subModuleId", getQuestions);

module.exports = router;
