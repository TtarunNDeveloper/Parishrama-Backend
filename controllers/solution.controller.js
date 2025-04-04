const express = require("express");
const Solution = require("../models/Solution");
const SolutionBank = require("../models/SolutionBank");

// Create Solution and SolutionBank entries
exports.createSolution = async function (req, res) {
    try {
        const { stream, questionType, testName, date, solutionBank } = req.body;

        // Validate required fields
        if (!stream || !questionType || !testName || !date || !solutionBank) {
            return res.status(400).json({ status: "error", message: "All fields are required" });
        }

        // Create Solution
        const solution = await Solution.create({
            stream,
            questionType,
            testName,
            date: new Date(date)
        });

        // Create SolutionBank entries
        const solutionBankEntries = await Promise.all(
            solutionBank.map(async (entry) => {
                if(!entry.questionNumber || typeof entry.questionNumber !== 'number'){
                    throw new Error('Question number is required');
                }
                // Validate based on question type
                if (questionType === "MCQ" && !entry.correctOption) {
                    throw new Error("Correct option is required for MCQ questions");
                }

                return await SolutionBank.create({
                    solutionRef: solution._id,
                    date: solution.date,
                    questionNumber: entry.questionNumber,
                    correctOption: entry.correctOption,
                    correctSolution: entry.correctSolution
                });
            })
        );

        res.status(201).json({
            status: "success",
            data: {
                solution,
                solutionBank: solutionBankEntries
            }
        });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};

// Get SolutionBank entries with filters
exports.getSolutionBank = async function (req, res) {
    try {
        const { stream, questionType, testName, date } = req.query;
        const filter = {};

        // Add filters
        if (stream) filter.stream = stream;
        if (questionType) filter.questionType = questionType;
        if (testName) filter.testName = testName;
        if (date) filter.date = new Date(date);

        const solutions = await Solution.find(filter);
        if (solutions.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "No solutions found with these filters"
            });
        }

        // Get solution bank entries
        const solutionBankEntries = await SolutionBank.find({
            solutionRef: { $in: solutions.map(s => s._id) }
        }).populate('solutionRef');

        res.status(200).json({
            status: "success",
            data: solutionBankEntries.sort((a,b) => a.questionNumber - b.questionNumber)
        });

    } catch (err) {
        console.error("Error in getSolutionBank:", err);
        res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};

// Update Solution
exports.updateSolutionById = async function (req, res) {
    try {
        const { questionType, testName, date } = req.body;

        const updatedSolution = await Solution.findByIdAndUpdate(
            req.params.solutionId,
            { questionType, testName, date: date ? new Date(date) : undefined },
            { new: true }
        );

        if (!updatedSolution) {
            return res.status(404).json({ status: "error", message: "Solution not found" });
        }

        res.status(200).json({ status: "success", data: updatedSolution });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};

// Delete Solution and associated SolutionBank entries
exports.deleteSolutionById = async function (req, res) {
    try {
        // Delete SolutionBank entries first
        await SolutionBank.deleteMany({ solutionRef: req.params.solutionId });

        // Then delete the Solution
        const deletedSolution = await Solution.findByIdAndDelete(req.params.solutionId);

        if (!deletedSolution) {
            return res.status(404).json({ status: "error", message: "Solution not found" });
        }

        res.status(200).json({ status: "success", message: "Solution and associated entries deleted" });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};

// Update SolutionBank entry
exports.updateSolutionBankById = async function (req, res) {
    try {
        const { questionNumber, correctOption, correctSolution } = req.body;

        const updatedEntry = await SolutionBank.findByIdAndUpdate(
            req.params.entryId,
            { questionNumber, correctOption, correctSolution },
            { new: true }
        ).populate('solutionRef');

        if (!updatedEntry) {
            return res.status(404).json({ status: "error", message: "SolutionBank entry not found" });
        }

        res.status(200).json({ status: "success", data: updatedEntry });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};

// Delete SolutionBank entry
exports.deleteSolutionBankById = async function (req, res) {
    try {
        const deletedEntry = await SolutionBank.findByIdAndDelete(req.params.entryId);

        if (!deletedEntry) {
            return res.status(404).json({ status: "error", message: "SolutionBank entry not found" });
        }

        res.status(200).json({ status: "success", message: "Entry deleted successfully" });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};