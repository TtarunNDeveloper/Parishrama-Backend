require('dotenv').config()
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URL,{
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB:", err));

const SubjectRoute = require('./routes/subject.route')
app.use('/',SubjectRoute)

const ChapterRoute = require('./routes/chapter.route')
app.use('/',ChapterRoute)

const SubtopicRoute = require('./routes/subtopic.route')
app.use('/',SubtopicRoute)

const QuestionRoute = require('./routes/question.route')
app.use('/',QuestionRoute)

const SolutionRoute = require('./routes/solution.route')
app.use('/',SolutionRoute)

const ReportRoute = require('./routes/report.route')
app.use('/',ReportRoute)

const StudentReportRoute = require('./routes/studentreport.route');
app.use('/',StudentReportRoute)

const UserModelRoute = require('./routes/user.routes');
app.use('/',UserModelRoute)


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});