console.log("SCRIPT LOADED");

const API_BASE = "http://127.0.0.1:9001/api";

let totalQuestions = 0;
let currentQuestionIndex = 0;
let sessionScores = [];
let sessionDifficulties = [];
let currentQuestionId = null;
let currentDifficulty = null;
let timerInterval;
let timeRemaining = 60;

let domainChartInstance = null;
let difficultyChartInstance = null;


// coding flow
async function getQuestion() {

    const questionLimitEl = document.getElementById("questionLimit");
    const domainEl = document.getElementById("domain");
    const questionBox = document.getElementById("questionBox");

    if (!questionLimitEl || !domainEl || !questionBox) return;

    if (currentQuestionIndex === 0) {
        totalQuestions = parseInt(questionLimitEl.value);
        sessionScores = [];
        sessionDifficulties = [];
        questionLimitEl.disabled = true;
    }

    if (currentQuestionIndex >= totalQuestions) {
        showSummary();
        return;
    }

    clearInterval(timerInterval);

    const domain = domainEl.value;

    const response = await fetch(`${API_BASE}/question/${domain}`);
    const data = await response.json();

    if (!data || data.error) {
        console.error("API Error:", data);
        alert("Failed to load question");
        return;
    }

    currentQuestionId = data.id;
    currentDifficulty = data.difficulty;

    questionBox.innerText = data.question_text;

    const answerEl = document.getElementById("answer");
    const resultEl = document.getElementById("result");

    if (answerEl) answerEl.value = "";
    if (resultEl) resultEl.innerText = "";

    currentQuestionIndex++;
    updateProgress();
    startTimer();
}


async function submitAnswer() {

    const answerEl = document.getElementById("answer");
    const resultEl = document.getElementById("result");

    if (!answerEl || !resultEl) return;

    const answer = answerEl.value.trim();
    if (!answer) return;

    clearInterval(timerInterval);

    const response = await fetch(`${API_BASE}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question_id: currentQuestionId,
            user_answer: answer
        })
    });

    const data = await response.json();

    sessionScores.push(data.score);
    sessionDifficulties.push(currentDifficulty);

    resultEl.innerText = `Score: ${data.score} / 100`;

    setTimeout(() => getQuestion(), 1500);
}


function updateProgress() {

    const bar = document.getElementById("progressBar");
    const text = document.getElementById("progressText");

    if (!bar || !text) return;

    let percent = (currentQuestionIndex / totalQuestions) * 100;
    bar.style.width = percent + "%";
    text.innerText = `Question ${currentQuestionIndex} of ${totalQuestions}`;
}


function startTimer() {

    const timerEl = document.getElementById("timerDisplay");
    if (!timerEl) return;

    timeRemaining = 60;
    timerEl.innerText = `Time Left: ${timeRemaining}s`;

    timerInterval = setInterval(() => {

        timeRemaining--;
        timerEl.innerText = `Time Left: ${timeRemaining}s`;

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            getQuestion();
        }

    }, 1000);
}


function showSummary() {

    const summary = document.getElementById("sessionSummary");
    const finalScore = document.getElementById("finalScore");

    if (!summary || !finalScore) return;

    summary.style.display = "block";

    const total = sessionScores.reduce((a, b) => a + b, 0);
    const average = total / sessionScores.length;

    finalScore.innerHTML =
        `<p><strong>Overall Average:</strong> ${average.toFixed(2)} / 100</p>`;
}


function restartSession() {

    currentQuestionIndex = 0;
    sessionScores = [];
    sessionDifficulties = [];

    clearInterval(timerInterval);

    const summary = document.getElementById("sessionSummary");
    if (summary) summary.style.display = "none";
}

//Mock Answer Submission
async function submitMockAnswer(questionId) {

    const answerEl = document.getElementById(`mockAnswer-${questionId}`);
    const resultEl = document.getElementById(`mockResult-${questionId}`);

    const answer = answerEl.value.trim();

    if (!answer) {
        alert("Please enter an answer");
        return;
    }

    const response = await fetch(`${API_BASE}/answer`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            question_id: questionId,
            user_answer: answer
        })
    });

    const data = await response.json();
    console.log("Attempt response:", data);

    resultEl.innerText = `Score: ${data.score} / 100`;
}
// mock interview
async function startMock() {

    const container = document.getElementById("mockContainer");
    if (!container) return;

    const response = await fetch(
        `${API_BASE}/mock-balanced/python`
    );

    const questions = await response.json();
    if (!questions) return;

    container.innerHTML = "";

    questions.forEach((q, index) => {
        container.innerHTML += `
            <div class="card mb-3">
                <div class="card-body">
                    <h5>Question ${index + 1}</h5>
                    <p>${q.question_text}</p>

                    <textarea 
                        id="mockAnswer-${q.id}" 
                        class="form-control mb-2" 
                        placeholder="Type your answer here..."></textarea>

                    <button 
                        onclick="submitMockAnswer(${q.id})" 
                        class="btn btn-primary">
                        Submit Answer
                    </button>

                    <p id="mockResult-${q.id}" class="mt-2"></p>
                </div>
            </div>
        `;
    });
}


// analytics
async function loadAnalytics(category = null) {

    const totalEl = document.getElementById("total");
    const avgEl = document.getElementById("average");
    const chart1 = document.getElementById("domainChart");
    const chart2 = document.getElementById("difficultyChart");

    if (!totalEl || !avgEl || !chart1 || !chart2) return;

    let url = `${API_BASE}/analytics`;
    if (category) url += `?category=${category}`;

    //  FETCH DATA
    const response = await fetch(url);
    const data = await response.json();

    console.log("Analytics Data:", data);

    //  TEXT UPDATE
    totalEl.innerText = `${data.total_attempts} attempts`;
    avgEl.innerText = `${data.average_score} / 100`;

    const ctx1 = chart1.getContext("2d");
    const ctx2 = chart2.getContext("2d");

    // Destroy previous charts
    if (domainChartInstance) domainChartInstance.destroy();
    if (difficultyChartInstance) difficultyChartInstance.destroy();

    const breakdown = data.difficulty_breakdown || {};
    const avgScores = data.difficulty_average_score || {};

    const easyCount = breakdown.easy || breakdown.Easy || 0;
    const mediumCount = breakdown.medium || breakdown.Medium || 0;
    const hardCount = breakdown.hard || breakdown.Hard || 0;

    const easyAvg = avgScores.easy || avgScores.Easy || 0;
    const mediumAvg = avgScores.medium || avgScores.Medium || 0;
    const hardAvg = avgScores.hard || avgScores.Hard || 0;

    //  PIE CHART
    difficultyChartInstance = new Chart(ctx2, {
        type: "pie",
        data: {
            labels: ["Easy", "Medium", "Hard"],
            datasets: [{
                data: [easyCount, mediumCount, hardCount],
                backgroundColor: [
                    "#22c55e",
                    "#f59e0b",
                    "#ef4444"
                ]
            }]
        }
    });

    //  BAR CHART
    domainChartInstance = new Chart(ctx1, {
        type: "bar",
        data: {
            labels: ["Easy", "Medium", "Hard"],
            datasets: [{
                label: "Average Score",
                data: [easyAvg, mediumAvg, hardAvg],
                backgroundColor: [
                    "#22c55e",
                    "#f59e0b",
                    "#ef4444"
                ]
            }]
        }
    });
}


window.onload = function () {
    if (document.getElementById("domainChart")) {
        loadAnalytics("coding");
    }
};
