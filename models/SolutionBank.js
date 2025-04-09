const mongoose = require('mongoose');

const SolutionBankSchema = new mongoose.Schema({
    solutionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Solution', required: true },
    date: { type: Date, required: true },
    questionNumber: { type: Number, required: true },
    correctOption: { type: String }, // For MCQ/TrueFalse
    correctSolution: { type: String, required: false } // For all question types
});

module.exports = mongoose.model('SolutionBank', SolutionBankSchema);