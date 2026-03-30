import { useState, useEffect, useRef } from 'react'
import { C } from './theme'
import { LESSONS, QUESTION_BANK, CURRICULUM, XP_PER_CORRECT, XP_PER_LEVEL, STORAGE_KEY } from './data'
import { gradeChallenge } from './grader'

// ─── CSS injected once ────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pop { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  @keyframes glow { 0%,100%{text-shadow:0 0 20px rgba(0,255,170,0.4)} 50%{text-shadow:0 0 40px rgba(0,255,170,0.8)} }
  @keyframes pFly { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0)} }
  .prt{position:fixed;pointer-events:none;width:8px;height:8px;border-radius:50%;background:#00ffaa;animation:pFly 1s ease-out forwards;box-shadow:0 0 6px #00ffaa;}
  .hcard{transition:transform 0.2s;} .hcard:hover{transform:translateY(-2px);}
  textarea:focus{outline:none;border-color:rgba(0,255,170,0.4)!important;box-shadow:0 0 0 2px rgba(0,255,170,0.1);}
  textarea{transition:border-color 0.2s,box-shadow 0.2s;}
  details>summary{list-style:none;} details>summary::-webkit-details-marker{display:none;}
`

// ─── Small reusable components ────────────────────────────────────────────────
function CodeBlock({ code, output }) {
  return (
    <div style={{ marginTop: 10, marginBottom: 4 }}>
      <pre style={{
        background: C.codeBg,
        border: `1px solid ${C.border}`,
        borderRadius: output ? '8px 8px 0 0' : 8,
        padding: '14px 16px',
        fontFamily: C.mono,
        fontSize: 13,
        color: C.green,
        overflowX: 'auto',
        margin: 0,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>{code}</pre>
      {output && (
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${C.border}`,
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '8px 16px',
          fontFamily: C.mono,
          fontSize: 12,
          color: '#88ddaa',
        }}>
          <span style={{ color: C.textMuted, fontSize: 10, marginRight: 8 }}>OUTPUT →</span>
          {output}
        </div>
      )}
    </div>
  )
}

function Tag({ children, color }) {
  const c = color || C.green
  return (
    <span style={{
      display: 'inline-block',
      background: c + '14',
      border: `1px solid ${c}33`,
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 10,
      color: c,
      letterSpacing: 2,
      fontFamily: C.mono,
    }}>{children}</span>
  )
}

function Header({ progress }) {
  const level = Math.floor(progress.xp / XP_PER_LEVEL) + 1
  const xpInLevel = progress.xp % XP_PER_LEVEL
  const xpPct = (xpInLevel / XP_PER_LEVEL) * 100

  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`,
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(0,255,170,0.015)',
      flexShrink: 0,
    }}>
      <div>
        <div style={{ fontFamily: C.display, fontSize: 20, fontWeight: 900, color: C.green, letterSpacing: 2, textShadow: '0 0 20px rgba(0,255,170,0.3)' }}>
          PY<span style={{ color: '#fff' }}>QUEST</span>
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 3 }}>30 DAYS TO PYTHON</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2 }}>LVL</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.green, lineHeight: 1 }}>{level}</div>
        </div>
        <div style={{ minWidth: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textMuted, marginBottom: 3 }}>
            <span>{xpInLevel} XP</span><span>{XP_PER_LEVEL}</span>
          </div>
          <div style={{ height: 5, background: '#0a1a10', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${xpPct}%`, background: `linear-gradient(90deg, ${C.greenDim}, ${C.green})`, borderRadius: 3, boxShadow: '0 0 8px rgba(0,255,170,0.4)', transition: 'width 0.5s' }} />
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>🔥</div>
          <div style={{ fontSize: 10, color: '#ff6b35' }}>{progress.streak}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Default progress state ───────────────────────────────────────────────────
function defaultProgress() {
  return {
    currentDay: 1,
    unlockedDays: [1],
    completedDays: [],
    xp: 0,
    streak: 0,
    dayScores: {},
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [progress, setProgress] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : defaultProgress()
    } catch {
      return defaultProgress()
    }
  })

  const [screen, setScreen] = useState('hub')         // hub | lesson | quiz | challenge | result
  const [activeDay, setActiveDay] = useState(null)
  const [lessonPage, setLessonPage] = useState(0)     // 0 = intro, 1..n = sections, n+1 = summary
  const [qIndex, setQIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [quizFeedback, setQuizFeedback] = useState(null)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const [challengeFeedback, setChallengeFeedback] = useState(null)
  const [particles, setParticles] = useState([])

  // Persist progress to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch { /* storage full or unavailable */ }
  }, [progress])

  // Inject global CSS once
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = GLOBAL_CSS
    document.head.appendChild(el)
    return () => el.remove()
  }, [])

  function spawnParticles() {
    setParticles(Array.from({ length: 14 }, (_, i) => ({
      id: Date.now() + i,
      x: 30 + Math.random() * 40,
      y: 30 + Math.random() * 40,
      dx: (Math.random() - 0.5) * 130,
      dy: -(50 + Math.random() * 70),
    })))
    setTimeout(() => setParticles([]), 1200)
  }

  // ── Navigation helpers ────────────────────────────────────────────────────
  function startDay(day) {
    setActiveDay(day)
    setLessonPage(0)
    setQIndex(0)
    setUserAnswer('')
    setQuizFeedback(null)
    setSessionCorrect(0)
    setChallengeAnswer('')
    setChallengeFeedback(null)
    setScreen('lesson')
  }

  const lesson = activeDay ? LESSONS[activeDay - 1] : null
  const questions = activeDay ? (QUESTION_BANK[activeDay] || []) : []
  const currentQ = questions[qIndex]

  // ── Lesson navigation ─────────────────────────────────────────────────────
  function advanceLessonPage() {
    if (!lesson) return
    if (lessonPage < lesson.sections.length) {
      setLessonPage(p => p + 1)
    } else {
      setScreen('quiz')
    }
  }

  // ── Quiz logic ────────────────────────────────────────────────────────────
  function submitQuizAnswer() {
    if (!userAnswer.trim() || !currentQ) return
    const q = currentQ
    let correct = false

    if (q.type === 'mc') {
      correct = userAnswer.trim().toUpperCase() === q.a.toUpperCase()
    } else {
      const ua = userAnswer.trim().toLowerCase().replace(/\s+/g, ' ')
      const ea = q.a.trim().toLowerCase().replace(/\s+/g, ' ')
      correct = ua === ea || ua.includes(ea) || ea.includes(ua)
    }

    if (correct) {
      spawnParticles()
      setSessionCorrect(s => s + 1)
      setProgress(p => ({ ...p, xp: p.xp + XP_PER_CORRECT }))
    }
    setQuizFeedback({ correct, explanation: q.e })
  }

  function nextQuestion() {
    if (qIndex + 1 >= questions.length) {
      setScreen('challenge')
    } else {
      setQIndex(i => i + 1)
      setUserAnswer('')
      setQuizFeedback(null)
    }
  }

  // ── Challenge logic (fully local) ─────────────────────────────────────────
  function submitChallenge() {
    if (!challengeAnswer.trim() || !lesson) return
    const result = gradeChallenge(challengeAnswer, lesson)
    if (result.passed) spawnParticles()
    setChallengeFeedback(result)
  }

  function skipChallenge() {
    setChallengeFeedback({
      passed: false,
      feedback: 'Skipped — no worries. Review the example solution and try again when you replay.',
      hint: lesson?.challenge?.exampleSolution || '',
    })
  }

  function finishDay() {
    if (!lesson) return
    setProgress(p => {
      const newCompleted = p.completedDays.includes(activeDay)
        ? p.completedDays
        : [...p.completedDays, activeDay]
      const nextDay = activeDay + 1
      const newUnlocked = nextDay <= 30 && !p.unlockedDays.includes(nextDay)
        ? [...p.unlockedDays, nextDay]
        : p.unlockedDays
      const bonus = challengeFeedback?.passed ? 100 : 25
      return {
        ...p,
        completedDays: newCompleted,
        unlockedDays: newUnlocked,
        currentDay: Math.max(p.currentDay, Math.min(nextDay, 30)),
        xp: p.xp + bonus,
        dayScores: { ...p.dayScores, [activeDay]: sessionCorrect },
      }
    })
    setScreen('result')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREENS
  // ═══════════════════════════════════════════════════════════════════════════

  const base = {
    minHeight: '100vh',
    background: C.bg,
    color: C.textPrimary,
    fontFamily: C.sans,
    display: 'flex',
    flexDirection: 'column',
  }

  // ── HUB ──────────────────────────────────────────────────────────────────
  if (screen === 'hub') {
    return (
      <div style={{ ...base, backgroundImage: 'radial-gradient(ellipse at 15% 20%, rgba(0,80,40,0.12) 0%, transparent 55%), radial-gradient(ellipse at 85% 80%, rgba(0,40,80,0.08) 0%, transparent 55%)', paddingBottom: 60 }}>
        <Header progress={progress} />

        {/* Stats */}
        <div style={{ padding: '16px 24px', display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}` }}>
          {[
            { label: 'DAYS DONE', value: `${progress.completedDays.length}/30` },
            { label: 'TOTAL XP', value: progress.xp.toLocaleString() },
            { label: 'NEXT UP', value: `Day ${progress.currentDay}` },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '10px 14px', background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 2 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 3, marginBottom: 14 }}>SELECT YOUR MISSION</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 9 }}>
            {CURRICULUM.map(item => {
              const done = progress.completedDays.includes(item.day)
              const unlocked = progress.unlockedDays.includes(item.day)
              const current = progress.currentDay === item.day && !done
              const score = progress.dayScores[item.day]
              return (
                <div
                  key={item.day}
                  className="hcard"
                  onClick={() => unlocked && startDay(item.day)}
                  style={{
                    background: done ? 'rgba(0,255,170,0.05)' : current ? 'rgba(0,255,170,0.03)' : C.surface,
                    border: `1px solid ${done ? 'rgba(0,255,170,0.25)' : current ? 'rgba(0,255,170,0.15)' : C.border}`,
                    borderRadius: 10,
                    padding: 13,
                    cursor: unlocked ? 'pointer' : 'default',
                    opacity: unlocked ? 1 : 0.3,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {current && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.green}, transparent)` }} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 18 }}>{item.emoji}</span>
                    <div style={{ fontSize: 9, color: C.textMuted, fontFamily: C.mono }}>
                      {done
                        ? <span style={{ color: C.greenDim }}>✓ {item.day}</span>
                        : !unlocked
                        ? <span>🔒 {item.day}</span>
                        : `DAY ${item.day}`
                      }
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: done ? C.green : C.textPrimary }}>{item.topic}</div>
                  {done && score !== undefined && (
                    <div style={{ fontSize: 10, color: C.gold, marginTop: 3 }}>
                      {'★'.repeat(Math.min(score, 4))}{'☆'.repeat(Math.max(0, 4 - score))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── LESSON ────────────────────────────────────────────────────────────────
  if (screen === 'lesson' && lesson) {
    const isIntro = lessonPage === 0
    const isLast = lessonPage === lesson.sections.length
    const section = (!isIntro && !isLast) ? lesson.sections[lessonPage - 1] : null
    const progress_pct = (lessonPage / (lesson.sections.length + 1)) * 100

    return (
      <div style={{ ...base }}>
        <Header progress={progress} />
        <div style={{ height: 3, background: '#0a1a10', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${progress_pct}%`, background: `linear-gradient(90deg, ${C.greenDim}, ${C.green})`, transition: 'width 0.4s' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 100px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button onClick={() => setScreen('hub')} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMuted, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: C.mono }}>
              ← HUB
            </button>
            <Tag>{isIntro ? 'OVERVIEW' : isLast ? 'SUMMARY' : `SECTION ${lessonPage} / ${lesson.sections.length}`}</Tag>
          </div>

          {isIntro && (
            <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>{lesson.emoji}</div>
              <div style={{ fontFamily: C.display, fontSize: 26, fontWeight: 900, color: C.green, marginBottom: 8, animation: 'glow 3s infinite' }}>
                Day {lesson.day}: {lesson.topic}
              </div>
              <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 24, lineHeight: 1.6 }}>
                {lesson.tagline}
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 10 }}>TODAY YOU'LL LEARN</div>
                {lesson.sections.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,255,170,0.1)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.green, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, paddingTop: 3 }}>{s.title}</div>
                  </div>
                ))}
                <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'flex', gap: 8 }}>
                  <Tag color={C.gold}>📝 4 QUESTIONS</Tag>
                  <Tag color="#88aaff">💻 1 CODING CHALLENGE</Tag>
                </div>
              </div>
            </div>
          )}

          {section && (
            <div key={lessonPage} style={{ animation: 'fadeUp 0.3s ease-out' }}>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 3, marginBottom: 8 }}>DAY {lesson.day} · {lesson.topic}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 14, lineHeight: 1.3 }}>{section.title}</div>
              <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.8, marginBottom: 16 }}>{section.text}</div>
              <CodeBlock code={section.code} output={section.output} />
              <div style={{ marginTop: 14, background: 'rgba(0,255,170,0.04)', border: `1px solid rgba(0,255,170,0.15)`, borderLeft: `3px solid ${C.green}`, borderRadius: '0 8px 8px 0', padding: '12px 16px', fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
                💡 {section.explain}
              </div>
            </div>
          )}

          {isLast && (
            <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 3, marginBottom: 16 }}>LESSON COMPLETE</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginBottom: 20 }}>Key Takeaway 🎯</div>
              <div style={{ background: 'rgba(0,255,170,0.06)', border: `1px solid rgba(0,255,170,0.25)`, borderRadius: 10, padding: '18px 20px', fontFamily: C.mono, fontSize: 13, color: C.green, lineHeight: 1.8, marginBottom: 20 }}>
                {lesson.keyTakeaway}
              </div>
              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
                Ready? Next up: <strong style={{ color: C.green }}>4 quiz questions</strong>, then a <strong style={{ color: C.gold }}>coding challenge</strong> where you write real Python.
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 24px', background: 'rgba(3,8,6,0.97)', borderTop: `1px solid ${C.border}`, backdropFilter: 'blur(10px)' }}>
          <button
            onClick={advanceLessonPage}
            style={{ width: '100%', background: 'rgba(0,255,170,0.1)', border: `1.5px solid ${C.borderActive}`, color: C.green, padding: 14, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: C.sans, letterSpacing: 1 }}
          >
            {isIntro ? 'START LESSON →'
              : isLast ? 'BEGIN QUIZ →'
              : `NEXT: ${lesson.sections[lessonPage]?.title || 'Summary'} →`}
          </button>
        </div>
      </div>
    )
  }

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  if (screen === 'quiz' && currentQ && lesson) {
    return (
      <div style={{ ...base }}>
        {particles.map(p => (
          <div key={p.id} className="prt" style={{ left: `${p.x}%`, top: `${p.y}%`, '--dx': `${p.dx}px`, '--dy': `${p.dy}px` }} />
        ))}
        <Header progress={progress} />

        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: C.mono }}>
            {CURRICULUM[activeDay - 1]?.emoji} {CURRICULUM[activeDay - 1]?.topic}
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            {questions.map((_, i) => (
              <div key={i} style={{ width: 28, height: 4, borderRadius: 2, background: i < qIndex ? C.green : i === qIndex ? 'rgba(0,255,170,0.35)' : 'rgba(0,255,170,0.1)', boxShadow: i < qIndex ? '0 0 6px rgba(0,255,170,0.4)' : 'none', transition: 'all 0.3s' }} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.green, fontFamily: C.mono }}>{sessionCorrect}/{qIndex} ✓</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 100px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
          <div key={qIndex} style={{ animation: 'fadeUp 0.25s ease-out' }}>
            <Tag color={currentQ.type === 'mc' ? '#88aaff' : C.gold}>
              {currentQ.type === 'mc' ? 'MULTIPLE CHOICE' : 'PREDICT OUTPUT'}
            </Tag>

            <div style={{ fontSize: 15, color: C.textPrimary, margin: '14px 0', lineHeight: 1.7 }}>
              {currentQ.q}
            </div>

            {currentQ.code && <CodeBlock code={currentQ.code} />}

            {currentQ.type === 'mc' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {currentQ.choices.map((ch, i) => {
                  const letter = ch[0]
                  const isCorrect = letter === currentQ.a
                  const isChosen = userAnswer === letter
                  return (
                    <button
                      key={i}
                      onClick={() => !quizFeedback && setUserAnswer(letter)}
                      style={{
                        background: quizFeedback
                          ? (isCorrect ? 'rgba(0,255,170,0.1)' : isChosen ? C.redBg : C.surface)
                          : (isChosen ? 'rgba(0,255,170,0.1)' : C.surface),
                        border: `1.5px solid ${quizFeedback
                          ? (isCorrect ? 'rgba(0,255,170,0.5)' : isChosen ? C.redBorder : C.border)
                          : (isChosen ? C.borderActive : C.border)}`,
                        borderRadius: 8, padding: '12px 16px',
                        color: quizFeedback
                          ? (isCorrect ? C.green : isChosen ? C.red : C.textSecondary)
                          : (isChosen ? C.green : C.textSecondary),
                        textAlign: 'left', cursor: quizFeedback ? 'default' : 'pointer',
                        fontFamily: C.mono, fontSize: 13, transition: 'all 0.15s',
                      }}
                    >
                      {ch}
                      {quizFeedback && isCorrect && <span style={{ float: 'right' }}>✓</span>}
                      {quizFeedback && isChosen && !isCorrect && <span style={{ float: 'right' }}>✗</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <textarea
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={2}
                disabled={!!quizFeedback}
                style={{ marginTop: 14, width: '100%', background: '#060d09', border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', color: C.green, fontFamily: C.mono, fontSize: 13, resize: 'vertical' }}
              />
            )}

            {quizFeedback && (
              <div style={{ marginTop: 14, animation: 'fadeUp 0.2s ease-out', background: quizFeedback.correct ? 'rgba(0,255,170,0.05)' : C.redBg, border: `1px solid ${quizFeedback.correct ? 'rgba(0,255,170,0.25)' : C.redBorder}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: quizFeedback.correct ? C.green : C.red, marginBottom: 6 }}>
                  {quizFeedback.correct ? '✓ Correct!' : `✗ Not quite — the answer is ${currentQ.a}`}
                  {quizFeedback.correct && <span style={{ fontSize: 11, color: C.gold, marginLeft: 10 }}>+{XP_PER_CORRECT} XP</span>}
                </div>
                <div style={{ fontSize: 13, color: quizFeedback.correct ? '#99ddbb' : '#dd9999', lineHeight: 1.7 }}>
                  {quizFeedback.explanation}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 24px', background: 'rgba(3,8,6,0.97)', borderTop: `1px solid ${C.border}`, backdropFilter: 'blur(10px)' }}>
          {!quizFeedback ? (
            <button
              onClick={submitQuizAnswer}
              disabled={!userAnswer.trim()}
              style={{ width: '100%', background: userAnswer.trim() ? 'rgba(0,255,170,0.1)' : 'rgba(0,255,170,0.02)', border: `1.5px solid ${userAnswer.trim() ? C.borderActive : C.border}`, color: userAnswer.trim() ? C.green : C.textMuted, padding: 14, borderRadius: 10, cursor: userAnswer.trim() ? 'pointer' : 'default', fontSize: 14, fontWeight: 600, fontFamily: C.sans, letterSpacing: 1 }}
            >
              CHECK ANSWER
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              style={{ width: '100%', background: 'rgba(0,255,170,0.1)', border: `1.5px solid ${C.borderActive}`, color: C.green, padding: 14, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: C.sans, letterSpacing: 1 }}
            >
              {qIndex + 1 >= questions.length ? 'CODING CHALLENGE →' : 'NEXT QUESTION →'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── CODING CHALLENGE ──────────────────────────────────────────────────────
  if (screen === 'challenge' && lesson) {
    const ch = lesson.challenge
    const difficultyLabel = activeDay <= 3 ? 'FILL IN BLANKS' : activeDay <= 10 ? 'GUIDED WRITE' : activeDay <= 20 ? 'FREE WRITE' : 'ADVANCED'
    const difficultyColor = activeDay <= 3 ? '#88aaff' : activeDay <= 10 ? C.green : activeDay <= 20 ? C.gold : '#ff8855'

    return (
      <div style={{ ...base }}>
        {particles.map(p => (
          <div key={p.id} className="prt" style={{ left: `${p.x}%`, top: `${p.y}%`, '--dx': `${p.dx}px`, '--dy': `${p.dy}px` }} />
        ))}
        <Header progress={progress} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 120px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
          <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
            <Tag color={C.gold}>💻 CODING CHALLENGE</Tag>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, margin: '14px 0 6px' }}>Write It Yourself</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
              Using only what you've learned so far, write Python code that solves this.
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              <Tag color={difficultyColor}>{difficultyLabel}</Tag>
              <Tag>DAY {activeDay} SKILLS</Tag>
            </div>

            <div style={{ background: 'rgba(0,255,170,0.04)', border: `1px solid rgba(0,255,170,0.18)`, borderRadius: 10, padding: '16px 18px', marginBottom: 16, fontSize: 14, color: C.textPrimary, lineHeight: 1.8 }}>
              {ch.prompt}
            </div>

            {ch.template && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 6 }}>STARTER TEMPLATE — fill in the ___</div>
                <CodeBlock code={ch.template} />
              </div>
            )}

            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 6 }}>YOUR CODE</div>
              <textarea
                value={challengeAnswer}
                onChange={e => setChallengeAnswer(e.target.value)}
                placeholder={ch.template ? 'Write your complete solution here...' : 'Write your Python code here...'}
                rows={ch.template ? 5 : 9}
                disabled={!!challengeFeedback}
                style={{ width: '100%', background: C.codeBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', color: C.green, fontFamily: C.mono, fontSize: 13, resize: 'vertical', lineHeight: 1.7 }}
              />
            </div>

            {!challengeFeedback && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12, color: C.textMuted, cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
                  💡 Show hint
                </summary>
                <div style={{ marginTop: 8, fontSize: 12, color: C.gold, background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.2)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.7 }}>
                  {ch.hint}
                </div>
              </details>
            )}

            {challengeFeedback && (
              <div style={{ marginTop: 16, animation: 'fadeUp 0.2s ease-out', background: challengeFeedback.passed ? 'rgba(0,255,170,0.05)' : C.redBg, border: `1px solid ${challengeFeedback.passed ? 'rgba(0,255,170,0.25)' : C.redBorder}`, borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: challengeFeedback.passed ? C.green : C.red, marginBottom: 8 }}>
                  {challengeFeedback.passed ? '✓ Great code!' : '✗ Almost — keep going'}
                  {challengeFeedback.passed && <span style={{ fontSize: 11, color: C.gold, marginLeft: 10 }}>+100 XP</span>}
                </div>
                <div style={{ fontSize: 13, color: challengeFeedback.passed ? '#99ddbb' : '#dd9999', lineHeight: 1.8 }}>
                  {challengeFeedback.feedback}
                </div>
                {!challengeFeedback.passed && challengeFeedback.hint && (
                  <div style={{ fontSize: 12, color: C.gold, background: 'rgba(255,200,0,0.06)', borderRadius: 6, padding: '8px 12px', marginTop: 10 }}>
                    💡 {challengeFeedback.hint}
                  </div>
                )}
                {challengeFeedback.passed && (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ fontSize: 11, color: C.textMuted, cursor: 'pointer' }}>See example solution</summary>
                    <CodeBlock code={ch.exampleSolution} />
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 24px', background: 'rgba(3,8,6,0.97)', borderTop: `1px solid ${C.border}`, backdropFilter: 'blur(10px)' }}>
          {!challengeFeedback ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={skipChallenge}
                style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMuted, padding: '13px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontFamily: C.mono, whiteSpace: 'nowrap' }}
              >
                Skip
              </button>
              <button
                onClick={submitChallenge}
                disabled={!challengeAnswer.trim()}
                style={{ flex: 1, background: challengeAnswer.trim() ? 'rgba(0,255,170,0.1)' : 'rgba(0,255,170,0.02)', border: `1.5px solid ${challengeAnswer.trim() ? C.borderActive : C.border}`, color: challengeAnswer.trim() ? C.green : C.textMuted, padding: 14, borderRadius: 10, cursor: challengeAnswer.trim() ? 'pointer' : 'default', fontSize: 14, fontWeight: 600, fontFamily: C.sans, letterSpacing: 1 }}
              >
                SUBMIT CODE
              </button>
            </div>
          ) : (
            <button
              onClick={finishDay}
              style={{ width: '100%', background: 'rgba(0,255,170,0.1)', border: `1.5px solid ${C.borderActive}`, color: C.green, padding: 14, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: C.sans, letterSpacing: 1 }}
            >
              COMPLETE DAY {activeDay} →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (screen === 'result') {
    const topic = CURRICULUM[activeDay - 1]
    const stars = sessionCorrect >= 4 ? 4 : sessionCorrect >= 3 ? 3 : sessionCorrect >= 2 ? 2 : 1
    const nextDay = activeDay < 30 ? CURRICULUM[activeDay] : null
    const totalXp = sessionCorrect * XP_PER_CORRECT + (challengeFeedback?.passed ? 100 : 25)

    return (
      <div style={{ ...base, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 10, animation: 'pop 0.5s ease-out' }}>
          {stars === 4 ? '🏆' : stars === 3 ? '⭐' : '💪'}
        </div>
        <div style={{ fontFamily: C.display, fontSize: 24, fontWeight: 900, color: C.green, animation: 'glow 2s infinite', marginBottom: 6 }}>
          DAY {activeDay} DONE!
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 20 }}>
          {topic?.emoji} {topic?.topic}
        </div>

        <div style={{ display: 'flex', gap: 8, fontSize: 26, marginBottom: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <span key={i} style={{ opacity: i <= stars ? 1 : 0.2, filter: i <= stars ? 'drop-shadow(0 0 8px #ffcc44)' : 'none' }}>⭐</span>
          ))}
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 28px', marginBottom: 24, minWidth: 260 }}>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
            {[
              { label: 'QUIZ', value: `${sessionCorrect}/4`, color: C.green },
              { label: 'CODE', value: challengeFeedback?.passed ? '✓' : '~', color: challengeFeedback?.passed ? C.green : C.gold },
              { label: 'XP', value: `+${totalXp}`, color: C.gold },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => startDay(activeDay)} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMuted, padding: '11px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: C.mono }}>
            🔄 Replay
          </button>
          {nextDay && (
            <button onClick={() => startDay(activeDay + 1)} style={{ background: 'rgba(0,255,170,0.1)', border: `1.5px solid ${C.borderActive}`, color: C.green, padding: '11px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: C.sans, letterSpacing: 1 }}>
              Day {activeDay + 1}: {nextDay.emoji} {nextDay.topic} →
            </button>
          )}
          <button onClick={() => setScreen('hub')} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMuted, padding: '11px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: C.mono }}>
            🗺 Hub
          </button>
        </div>
      </div>
    )
  }

  return null
}
