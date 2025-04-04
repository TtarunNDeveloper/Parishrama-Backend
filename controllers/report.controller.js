const Report = require("../models/Report");
const ReportBank = require("../models/ReportBank");
const Solution = require("../models/Solution");

// Create Report and ReportBank entries
exports.createReport = async (req, res) => {
    try {
        const { stream, questionType, testName, date, marksType, reportBank } = req.body;

        // Validate required fields
        if (!stream || !questionType || !testName || !date || !marksType || !reportBank) {
            return res.status(400).json({ 
                status: "error", 
                message: "All fields are required: stream, questionType, testName, date, marksType, reportBank" 
            });
        }

        // Check if corresponding Solution exists
        const solution = await Solution.findOne({ 
            testName,
            date: new Date(date),
            questionType,
            stream
        });

        if (!solution) {
            return res.status(400).json({ 
                status: "error", 
                message: "No solution exists for this test/date/questionType/stream combination" 
            });
        }

        // Create Report
        const report = await Report.create({
            stream,
            questionType,
            testName,
            marksType,
            date: new Date(date)
        });

        // Create ReportBank entries
        const reportBankEntries = await Promise.all(
            reportBank.map(entry => {
                if (!entry.regNumber) {
                    throw new Error("Registration number is required for all entries");
                }
                return ReportBank.create({
                    reportRef: report._id,
                    date: report.date,
                    regNumber: entry.regNumber,
                    markedOptions: entry.markedOptions || new Map(),
                    unmarkedOptions: entry.unmarkedOptions || []
                });
            })
        );

        res.status(201).json({
            status: "success",
            message: "Report and entries created successfully",
            reportId: report._id,
            entriesCreated: reportBankEntries.length
        });

    } catch (err) {
        if(err.code === 11000){
            return res.status(400).json({
                status: "error",
                message: "Duplicate entry detected. Please clean your database indexes.",
                hint: "Run db.reportbanks.dropIndex('rollNo_1') in MongoDB Shell"
            });
        }
        res.status(400).json({ 
            status: "error", 
            message: err.message || "Failed to create report" 
        });
    }
};

// Get ReportBank entries with filters
exports.getReportBank = async (req, res) => {
    try {
        const { 
            reportRef, 
            testName, 
            stream, 
            dateFrom, 
            dateTo,
            regNumber 
        } = req.query;

        // Build filter step by step
        const reportFilter = {};
        const reportBankFilter = {};

        // Report reference filter
        if (reportRef) {
            reportBankFilter.reportRef = reportRef;
        }

        // Stream filter
        if (stream) {
            reportFilter.stream = stream;
        }

        // Date range filter
        if (dateFrom && dateTo) {
            reportFilter.date = {
                $gte: new Date(dateFrom),
                $lte: new Date(dateTo)
            };
        }

        // Other filters
        if (testName) reportFilter.testName = testName;
        if (regNumber) reportBankFilter.regNumber = regNumber;

        // Find matching reports
        const reports = await Report.find(reportFilter);
        if (reports.length === 0) {
            return res.status(404).json({ 
                status: "error", 
                message: "No reports found matching criteria" 
            });
        }

        // Add report IDs to report bank filter
        reportBankFilter.reportRef = { $in: reports.map(r => r._id) };

        // Get ReportBank entries with populated data
        const entries = await ReportBank.find(reportBankFilter)
            .populate('reportRef');

        // Format response
        const formattedEntries = entries.map(entry => ({
            reportId: entry.reportRef._id,
            stream: entry.reportRef.stream,
            testName: entry.reportRef.testName,
            date: entry.reportRef.date,
            marksType: entry.reportRef.marksType,
            regNumber: entry.regNumber,
            markedOptions: Object.fromEntries(entry.markedOptions),
            unmarkedOptions: entry.unmarkedOptions
        }));

        res.status(200).json({
            status: "success",
            count: formattedEntries.length,
            data: formattedEntries
        });

    } catch (err) {
        console.error("Error in getReportBank:", err);
        res.status(500).json({ 
            status: "error", 
            message: err.message || "Failed to fetch report data" 
        });
    }
};
// Get ALL ReportBank entries without filters
exports.getAllReportBank = async (req, res) => {
    try {
        // Get all ReportBank entries with populated data
        const entries = await ReportBank.find()
            .populate('reportRef');

        // Format response for better readability
        const formattedEntries = entries.map(entry => ({
            reportId: entry.reportRef._id,
            stream: entry.reportRef.stream,
            testName: entry.reportRef.testName,
            date: entry.reportRef.date,
            marksType: entry.reportRef.marksType,
            regNumber: entry.regNumber,
            markedOptions: Object.fromEntries(entry.markedOptions),
            unmarkedOptions: entry.unmarkedOptions
        }));

        res.status(200).json({
            status: "success",
            count: formattedEntries.length,
            data: formattedEntries
        });

    } catch (err) {
        console.error("Error in getAllReportBank:", err);
        res.status(500).json({ 
            status: "error", 
            message: err.message || "Failed to fetch all report data" 
        });
    }
};
// Get single Report by ID
exports.getReportById = async (req, res) => {
    try {
      const report = await Report.findById(req.params.id);
  
      if (!report) {
        return res.status(404).json({ 
          status: "error", 
          message: "Report not found" 
        });
      }
  
      res.status(200).json({
        status: "success",
        data: {
            _id: report._id,
            stream: report.stream,
            questionType: report.questionType,
            testName: report.testName,
            marksType: report.marksType,
            date: report.date,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt
        }
      });
  
    } catch (err) {
      res.status(500).json({ 
        status: "error", 
        message: err.message || "Failed to fetch report" 
      });
    }
};

// Update Report
exports.updateReportById = async function (req, res) {
    try {
        const { questionType, testName, date, marksType } = req.body;

        const updatedReport = await Report.findByIdAndUpdate(
            req.params.reportId,
            { 
                questionType, 
                testName, 
                date: date ? new Date(date) : undefined,
                marksType
            },
            { new: true }
        );

        if (!updatedReport) {
            return res.status(404).json({ status: "error", message: "Report not found" });
        }

        res.status(200).json({ status: "success", data: updatedReport });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};

// Delete Report and associated ReportBank entries
exports.deleteReportById = async function (req, res) {
    try {
        // Delete ReportBank entries first
        await ReportBank.deleteMany({ reportRef: req.params.reportId });

        // Then delete the Report
        const deletedReport = await Report.findByIdAndDelete(req.params.reportId);

        if (!deletedReport) {
            return res.status(404).json({ status: "error", message: "Report not found" });
        }

        res.status(200).json({ status: "success", message: "Report and associated entries deleted" });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};

// Update ReportBank entry
exports.updateReportBankById = async function (req, res) {
    try {
        const { regNumber, markedOptions, unmarkedOptions } = req.body;

        const updatedEntry = await ReportBank.findByIdAndUpdate(
            req.params.entryId,
            { regNumber, markedOptions, unmarkedOptions },
            { new: true }
        ).populate('reportRef');

        if (!updatedEntry) {
            return res.status(404).json({ status: "error", message: "ReportBank entry not found" });
        }

        res.status(200).json({ status: "success", data: updatedEntry });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};

// Delete ReportBank entry
exports.deleteReportBankById = async function (req, res) {
    try {
        const deletedEntry = await ReportBank.findByIdAndDelete(req.params.entryId);

        if (!deletedEntry) {
            return res.status(404).json({ status: "error", message: "ReportBank entry not found" });
        }

        res.status(200).json({ status: "success", message: "Entry deleted successfully" });

    } catch (err) {
        res.status(400).json({ status: "error", message: err.message });
    }
};