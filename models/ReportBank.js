const mongoose = require('mongoose');

const ReportBankSchema = new mongoose.Schema({
    reportRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
    date: { type: Date, required: true },
    regNumber: { type: String, required: true }, // Registration number of student
    markedOptions: { type: Map, of: String }, // Map of questionNumber to marked option
    unmarkedOptions: { type: [Number] } // Array of question numbers that were unmarked
});
ReportBankSchema.index({ regNumber: 1 });
ReportBankSchema.index({ regNumber: 1, date: 1 });

module.exports = mongoose.model('ReportBank', ReportBankSchema);