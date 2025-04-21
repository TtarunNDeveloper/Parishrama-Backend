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

        // Validate and create SolutionBank entries
        const solutionBankEntries = await Promise.all(
            solutionBank.map(async (entry) => {
                if (!entry.questionNumber || typeof entry.questionNumber !== 'number') {
                    throw new Error('Question number is required and must be a number');
                }

                // Validate based on question type
                if (questionType === "MCQ") {
                    if (!entry.correctOptions || !Array.isArray(entry.correctOptions)) {
                        throw new Error("correctOptions array is required for MCQ questions");
                    }
                    if (entry.correctOptions.length === 0) {
                        throw new Error("At least one correct option must be specified for MCQ questions");
                    }
                }

                return await SolutionBank.create({
                    solutionRef: solution._id,
                    date: solution.date,
                    questionNumber: entry.questionNumber,
                    correctOptions: entry.correctOptions || [], // Ensure this is always an array
                    correctSolution: entry.correctSolution || ""
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

        // Get solution bank entries with all necessary fields
        const solutionBankEntries = await SolutionBank.find({
            solutionRef: { $in: solutions.map(s => s._id) }
        })
        .populate('solutionRef')
        .select('solutionRef questionNumber correctOptions correctSolution date'); // Explicitly select fields

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
        const { questionNumber, correctOptions, correctSolution } = req.body;

        // Validate for MCQ type
        const entry = await SolutionBank.findById(req.params.entryId).populate('solutionRef');
        if (!entry) {
            return res.status(404).json({ status: "error", message: "SolutionBank entry not found" });
        }

        if (entry.solutionRef.questionType === "MCQ") {
            if (!correctOptions || !Array.isArray(correctOptions)) {
                return res.status(400).json({ 
                    status: "error", 
                    message: "correctOptions array is required for MCQ questions" 
                });
            }
            if (correctOptions.length === 0) {
                return res.status(400).json({ 
                    status: "error", 
                    message: "At least one correct option must be specified for MCQ questions" 
                });
            }
        }

        const updatedEntry = await SolutionBank.findByIdAndUpdate(
            req.params.entryId,
            { 
                questionNumber, 
                correctOptions: correctOptions || [], // Ensure array
                correctSolution 
            },
            { new: true }
        ).populate('solutionRef');

        res.status(200).json({ status: "success", data: updatedEntry });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};

//controller for bulk updates
exports.updateSolutionsInBulk = async function (req, res) {
    try {
        console.log("Received bulk update request with data:", req.body);
        
        const { solutionId, solutionBank } = req.body;

        // Validate solutionId
        if (!solutionId) {
            return res.status(400).json({ 
                status: "error", 
                message: "Test ID is required" 
            });
        }

        if (!mongoose.Types.ObjectId.isValid(solutionId)) {
            return res.status(400).json({ 
                status: "error", 
                message: "Invalid test ID format" 
            });
        }

        // Validate solutionBank
        if (!solutionBank || !Array.isArray(solutionBank)) {
            return res.status(400).json({ 
                status: "error", 
                message: "Solutions data must be an array" 
            });
        }

        if (solutionBank.length === 0) {
            return res.status(400).json({ 
                status: "error", 
                message: "No solutions provided for update" 
            });
        }

        // Validate each question update
        const validationErrors = [];
        solutionBank.forEach((entry, index) => {
            if (!entry.questionNumber || typeof entry.questionNumber !== 'number') {
                validationErrors.push(`Question ${index + 1}: Missing or invalid question number`);
            }
            
            if (entry.isGrace && entry.correctOptions?.length > 0) {
                validationErrors.push(`Question ${entry.questionNumber}: Grace questions cannot have correct options`);
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                status: "error", 
                message: "Validation failed",
                errors: validationErrors 
            });
        }

        // Prepare bulk operations
        const updateOperations = solutionBank.map(entry => ({
            updateOne: {
                filter: { 
                    solutionRef: solutionId,
                    questionNumber: entry.questionNumber 
                },
                update: {
                    $set: {
                        correctOptions: entry.correctOptions || [],
                        correctSolution: entry.correctSolution || "",
                        isGrace: entry.isGrace || false
                    }
                }
            }
        }));

        // Execute bulk write
        const result = await SolutionBank.bulkWrite(updateOperations);
        
        res.status(200).json({ 
            status: "success", 
            modifiedCount: result.modifiedCount,
            message: `Successfully updated ${result.modifiedCount} questions`
        });

    } catch (err) {
        console.error("Bulk update error:", err);
        
        let errorMessage = "Failed to update solutions";
        if (err.name === 'MongoError' && err.code === 11000) {
            errorMessage = "Duplicate question numbers detected";
        } else if (err.name === 'ValidationError') {
            errorMessage = "Data validation failed";
        }
        
        res.status(400).json({ 
            status: "error", 
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
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

//regenrating post edit/update
exports.regenerateReports = async function (req, res) {
    try {
        const { solutionId, graceQuestions = [] } = req.body;

        // Get the updated solution
        const solution = await Solution.findById(solutionId);
        if (!solution) {
            return res.status(404).json({ status: "error", message: "Solution not found" });
        }

        // Get all report banks for this solution
        const reportBanks = await ReportBank.find({ reportRef: solution._id });

        // Process grace questions
        const graceQuestionNumbers = graceQuestions.map(Number).filter(q => !isNaN(q));

        // Get all student reports for this test
        const studentReports = await StudentReport.find({
            testName: solution.testName,
            date: solution.date,
            stream: solution.stream
        });

        // Update each student report
        const updatedReports = await Promise.all(studentReports.map(async (report) => {
            const reportBank = reportBanks.find(rb => rb.regNumber === report.regNumber);
            if (!reportBank) return report;

            let correctAnswers = report.correctAnswers;
            let wrongAnswers = report.wrongAnswers;
            let totalMarks = report.totalMarks;

            // Process grace questions
            graceQuestionNumbers.forEach(qNum => {
                if (reportBank.unmarkedOptions.includes(qNum)) {
                    // Student didn't attempt this question - no grace
                    return;
                }

                const markedOption = reportBank.markedOptions.get(qNum.toString());
                if (markedOption) {
                    // Student attempted this question - add grace
                    correctAnswers += 1;
                    wrongAnswers -= 1;
                    totalMarks += 4;
                }
            });

            // Process solution changes
            const updatedResponses = report.responses.map(response => {
                const solutionForQuestion = solution.solutionBank.find(
                    sol => sol.questionNumber === response.questionNumber
                );

                if (!solutionForQuestion) return response;

                const isNowCorrect = solutionForQuestion.correctOptions.includes(response.markedOption);
                
                if (isNowCorrect && !response.isCorrect) {
                    // This answer is now correct (was wrong before)
                    correctAnswers += 1;
                    wrongAnswers -= 1;
                    totalMarks += 4;
                    return { ...response, isCorrect: true };
                } else if (!isNowCorrect && response.isCorrect) {
                    // This answer is now wrong (was correct before)
                    correctAnswers -= 1;
                    wrongAnswers += 1;
                    totalMarks -= 4;
                    return { ...response, isCorrect: false };
                }
                return response;
            });

            // Calculate new accuracy
            const accuracy = Math.round((correctAnswers / report.totalQuestions) * 100);

            // Update the report
            return await StudentReport.findByIdAndUpdate(
                report._id,
                {
                    correctAnswers,
                    wrongAnswers,
                    unattempted: report.totalQuestions - correctAnswers - wrongAnswers,
                    accuracy,
                    totalMarks,
                    responses: updatedResponses
                },
                { new: true }
            );
        }));

        res.status(200).json({
            status: "success",
            message: `Reports regenerated for ${updatedReports.length} students`,
            updatedCount: updatedReports.length
        });

    } catch (err) {
        console.error("Error regenerating reports:", err);
        res.status(500).json({ 
            status: "error", 
            message: err.message || "Failed to regenerate reports" 
        });
    }
};