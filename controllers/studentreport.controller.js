const StudentReport = require("../models/StudentReport");
const Subject = require("../models/Subjects");
const Chapter = require("../models/Chapters");
const Subtopic = require("../models/Subtopic");

// Create StudentReport (frontend sends pre-calculated values)
exports.createStudentReport = async (req, res) => {
  try {
      const requiredFields = [
          'regNumber', 'stream', 'testName', 'date',
          'marksType', 'totalQuestions', 'correctAnswers', 'wrongAnswers',
          'unattempted', 'accuracy','percentage', 'totalMarks', 'percentile', 'responses'
      ];
  
      // Validate all required fields exist
      const missingFields = requiredFields.filter(field => !req.body[field]);
      if (missingFields.length > 0) {
          return res.status(400).json({
              status: "error",
              message: `Missing required fields: ${missingFields.join(', ')}`
          });
      }
  
      // Create report
      const studentReport = await StudentReport.create({
          ...req.body,
          date: new Date(req.body.date)
      });
  
      res.status(201).json({
          status: "success",
          data: studentReport
      });
  
  } catch (err) {
      console.error("Error creating student report:", err);
      res.status(500).json({
          status: "error",
          message: err.message
      });
  }
};

// Get all StudentReports with filters (simplified)
exports.getStudentReports = async (req, res) => {
    try {
        const { regNumber, testName, date, minAccuracy, maxAccuracy } = req.query;
        const filter = {};

        // Apply basic filters
        if (regNumber) filter.regNumber = regNumber;
        if (testName) filter.testName = testName;
        if (date) filter.date = new Date(date);

        // Accuracy range filter
        if (minAccuracy || maxAccuracy) {
            filter.accuracy = {};
            if (minAccuracy) filter.accuracy.$gte = Number(minAccuracy);
            if (maxAccuracy) filter.accuracy.$lte = Number(maxAccuracy);
        }

        // Get reports without unnecessary population
        const reports = await StudentReport.find(filter)
            .sort({ date: -1 });

        res.status(200).json({
            status: "success",
            count: reports.length,
            data: reports
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};

//Get all StudentReports with RegNumber
exports.getStudentReportByStudentId = async (req, res) => {
    try {
      const { regNumber } = req.params;
  
      if (!regNumber) {
        return res.status(400).json({
          status: 'error',
          message: 'Registration number is required'
        });
      }
  
      const reports = await StudentReport.find({ regNumber })
        .select('testName date correctAnswers wrongAnswers unattempted totalMarks percentile accuracy')
        .sort({ date: -1 }) 
        .lean();
  
      if (!reports || reports.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No reports found for this student'
        });
      }
  
      res.status(200).json({
        status: 'success',
        data: reports
      });
  
    } catch (err) {
      console.error('Error fetching student reports:', err);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
};

// Get single report by ID
exports.getStudentReportById = async (req, res) => {
    try {
        const report = await StudentReport.findById(req.params.id)
            .populate('subject', 'subjectName')
            .populate('chapter', 'chapterName')
            .populate('subtopic', 'subtopicName');

        if (!report) {
            return res.status(404).json({
                status: "error",
                message: "Report not found"
            });
        }

        res.status(200).json({
            status: "success",
            data: report
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};

// Update report (frontend sends updated calculations)
exports.updateStudentReport = async (req, res) => {
    try {
        const updatedData = {
            ...req.body,
            date: req.body.date ? new Date(req.body.date) : undefined
        };

        const updatedReport = await StudentReport.findByIdAndUpdate(
            req.params.id,
            updatedData,
            { new: true }
        ).populate('subject', 'subjectName')
         .populate('chapter', 'chapterName')
         .populate('subtopic', 'subtopicName');

        if (!updatedReport) {
            return res.status(404).json({
                status: "error",
                message: "Report not found"
            });
        }

        res.status(200).json({
            status: "success",
            data: updatedReport
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};

// Delete report
exports.deleteStudentReport = async (req, res) => {
    try {
        const deletedReport = await StudentReport.findByIdAndDelete(req.params.id);

        if (!deletedReport) {
            return res.status(404).json({
                status: "error",
                message: "Report not found"
            });
        }

        res.status(200).json({
            status: "success",
            message: "Report deleted successfully"
        });

    } catch (err) {
        res.status(500).json({
            status: "error",
            message: err.message
        });
    }
};