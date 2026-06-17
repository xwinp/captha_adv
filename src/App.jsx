import { useEffect, useMemo, useState } from "react";

const STATUS = {
  idle: "请选择答案后提交",
  loading: "正在加载题目...",
  verifying: "正在验证...",
  success: "验证通过",
  fail: "验证失败，请重试",
  error: "请求失败，请检查服务是否启动",
};

function App() {
  const [groups, setGroups] = useState([]);
  const [challenge, setChallenge] = useState(null);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [imageStats, setImageStats] = useState([]);
  const [status, setStatus] = useState("loading");
  const [resultType, setResultType] = useState("muted");

  const activeGroup = useMemo(
    () => groups.find((group) => group.prompt === selectedPrompt),
    [groups, selectedPrompt],
  );

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    await Promise.all([loadGroups(), loadRandomQuestion()]);
  }

  async function loadGroups() {
    try {
      const response = await fetch("/local-folders");
      if (!response.ok) throw new Error("folders_failed");

      const data = await response.json();
      setGroups(data.groups ?? []);
    } catch {
      setGroups([]);
    }
  }

  async function loadRandomQuestion() {
    setStatus("loading");
    setResultType("muted");

    try {
      const response = await fetch("/local-challenge");
      if (!response.ok) throw new Error("challenge_failed");

      const data = await response.json();
      applyChallenge(data);
    } catch {
      setChallenge(null);
      setSelectedAnswers([]);
      setImageStats([]);
      setStatus("error");
      setResultType("error");
    }
  }

  async function loadSpecificQuestion(promptName, folderName) {
    setStatus("loading");
    setResultType("muted");

    try {
      const response = await fetch(
        `/local-challenge/${encodeURIComponent(promptName)}/${encodeURIComponent(folderName)}`,
      );
      if (!response.ok) throw new Error("challenge_failed");

      const data = await response.json();
      applyChallenge(data);
    } catch {
      setChallenge(null);
      setSelectedAnswers([]);
      setImageStats([]);
      setStatus("error");
      setResultType("error");
    }
  }

  function applyChallenge(nextChallenge) {
    setChallenge(nextChallenge);
    setSelectedPrompt(nextChallenge.promptGroup);
    setSelectedAnswers([]);
    setImageStats([]);
    setPreviewImage(null);
    setStatus("idle");
    setResultType("muted");
  }

  function toggleAnswer(value) {
    if (!challenge) return;

    setStatus("idle");
    setResultType("muted");

    setSelectedAnswers((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  }

  async function submitAnswer() {
    if (!challenge || selectedAnswers.length === 0) return;

    setStatus("verifying");
    setResultType("muted");

    try {
      const response = await fetch("/local-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptGroup: challenge.promptGroup,
          folderName: challenge.folderName,
          answers: selectedAnswers,
        }),
      });
      if (!response.ok) throw new Error("verify_failed");

      const data = await response.json();
      setStatus(data.success ? "success" : "fail");
      setResultType(data.success ? "success" : "error");
      loadCurrentImageStats().catch(() => setImageStats([]));
    } catch {
      setStatus("error");
      setResultType("error");
    }
  }

  async function loadCurrentImageStats() {
    if (!challenge) return;

    const response = await fetch("/local-stats");
    if (!response.ok) throw new Error("stats_failed");

    const data = await response.json();
    const rows = data.images ?? [];
    setImageStats(
      rows.filter((row) => (
        row.promptGroup === challenge.promptGroup
        && row.folderName === challenge.folderName
      )),
    );
  }

  function formatPercent(value) {
    return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "-";
  }

  const isBusy = status === "loading" || status === "verifying";

  return (
    <main className="page">
      <section className="demo-modal" aria-label="验证码 demo">
        <div className="challenge-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Captcha Demo</p>
              <h1>本地题目验证</h1>
            </div>
            <button className="ghost-button" type="button" onClick={loadRandomQuestion} disabled={isBusy}>
              随机题目
            </button>
          </div>

          <div className="meta-row">
            <span>{challenge ? `${challenge.promptGroup} / ${challenge.folderName}` : "未加载题目"}</span>
            <span>{challenge?.selectionMode === "multiple" ? "多选" : "单选"}</span>
          </div>

          <div className="prompt-card">
            {challenge?.promptImages?.length ? (
              challenge.promptImages.map((imageUrl) => (
                <img key={imageUrl} src={imageUrl} alt="题干" />
              ))
            ) : (
              <div className="empty-state">{STATUS[status]}</div>
            )}
          </div>

          <div className="choice-grid">
            {(challenge?.choices ?? []).map((choice) => {
              const isSelected = selectedAnswers.includes(choice.value);

              return (
                <div
                  key={choice.value}
                  className={`choice-card ${isSelected ? "selected" : ""} ${isBusy ? "is-disabled" : ""}`}
                  role="button"
                  tabIndex={isBusy ? -1 : 0}
                  onClick={() => {
                    if (!isBusy) setPreviewImage(choice);
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && !isBusy) {
                      event.preventDefault();
                      setPreviewImage(choice);
                    }
                  }}
                >
                  <img src={choice.imageUrl} alt={choice.value} />
                  <span>{choice.value}</span>
                  <button
                    className="select-corner"
                    type="button"
                    aria-label={`选择 ${choice.value}`}
                    disabled={isBusy}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleAnswer(choice.value);
                    }}
                  >
                    {isSelected ? "已选" : "选择"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="action-row">
            <button
              className="primary-button"
              type="button"
              onClick={submitAnswer}
              disabled={isBusy || selectedAnswers.length === 0}
            >
              提交验证
            </button>
            <div className={`status-pill ${resultType}`}>{STATUS[status]}</div>
            {imageStats.length > 0 && (
              <div className="inline-stats" aria-label="当前题目每张图片正确率">
                {imageStats.map((stat) => (
                  <span key={stat.key} className="inline-stat">
                    <span>{stat.value}</span>
                    <strong>{formatPercent(stat.accuracy)}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="selector-panel">
          <div className="selector-header">
            <p className="eyebrow">Question Picker</p>
            <h2>选择题目</h2>
            <p>先选 prompt，再选 Q1/Q2。默认进入页面会先弹出随机题目。</p>
          </div>

          <div className="selector-block">
            <h3>Prompt</h3>
            <div className="chip-list">
              {groups.map((group) => (
                <button
                  key={group.prompt}
                  className={`chip ${selectedPrompt === group.prompt ? "active" : ""}`}
                  type="button"
                  onClick={() => setSelectedPrompt(group.prompt)}
                >
                  {group.prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="selector-block">
            <h3>Question</h3>
            <div className="chip-list">
              {(activeGroup?.questions ?? []).map((question) => (
                <button
                  key={question.folderName}
                  className={`chip ${
                    challenge?.promptGroup === selectedPrompt && challenge?.folderName === question.folderName
                      ? "active"
                      : ""
                  }`}
                  type="button"
                  onClick={() => loadSpecificQuestion(selectedPrompt, question.folderName)}
                  disabled={isBusy}
                >
                  {question.folderName}
                </button>
              ))}
              {!activeGroup && <span className="hint">请选择一个 prompt</span>}
            </div>
          </div>
        </aside>
      </section>

      {previewImage && (
        <div className="image-preview" role="dialog" aria-modal="true" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-card" onClick={(event) => event.stopPropagation()}>
            <button className="preview-close" type="button" onClick={() => setPreviewImage(null)}>
              关闭
            </button>
            <img src={previewImage.imageUrl} alt={previewImage.value} />
            <p>{previewImage.value}</p>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
