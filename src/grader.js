// Local challenge grader — no API required.
// Uses topic-aware keyword matching + structural checks.

const STOPWORDS = new Set([
  'print','True','False','None','self','def','class','for','in','if','else',
  'elif','while','return','import','from','try','except','finally','with','as',
  'pass','break','continue','lambda','and','or','not','len','range','list',
  'dict','str','int','float','bool','type','sum','max','min','sorted','map',
  'filter','open','super','isinstance','enumerate','append','pop','sort',
  'split','strip','upper','lower','replace','get','keys','values','items',
])

const TOPIC_CHECKS = {
  'Variables':            a => a.includes('=') && a.includes('print'),
  'Data Types':           a => a.includes('=') && a.includes('print'),
  'Type Conversion':      a => /int\(|float\(|str\(/.test(a),
  'Strings':              a => a.includes('print') && (a.includes('+') || a.includes('len(')),
  'String Methods':       a => /\.upper\(\)|\.lower\(\)|\.strip\(\)|\.replace\(|\.split\(/.test(a),
  'f-Strings':            a => /f['"`]/.test(a),
  'Lists':                a => a.includes('[') && a.includes('print'),
  'List Methods':         a => /\.append\(|\.pop\(|\.sort\(|\.insert\(|\.remove\(/.test(a),
  'Slicing':              a => /\[.*:/.test(a),
  'if / else':            a => a.includes('if ') && a.includes(':'),
  'elif chains':          a => a.includes('if ') && a.includes('elif'),
  'Comparison Operators': a => /==|!=|>=|<=|and |or /.test(a),
  'for loops':            a => a.includes('for ') && a.includes('in '),
  'while loops':          a => a.includes('while '),
  'break & continue':     a => a.includes('break') || a.includes('continue'),
  'Functions':            a => a.includes('def ') && a.includes(':'),
  'Parameters':           a => a.includes('def ') && /\(.*\w/.test(a),
  'Return Values':        a => a.includes('def ') && a.includes('return '),
  'Dictionaries':         a => a.includes('{') && a.includes(':'),
  'Dict Methods':         a => /\.keys\(\)|\.values\(\)|\.items\(\)|\.get\(/.test(a),
  'Tuples & Sets':        a => /\(|\{/.test(a) && (a.includes('&') || a.includes('|') || a.includes(',')),
  'List Comprehensions':  a => /\[.+for.+in/.test(a),
  'Error Handling':       a => a.includes('try:') || a.includes('except'),
  'File I/O':             a => a.includes('open('),
  'Modules':              a => a.includes('import '),
  'Classes':              a => a.includes('class ') && a.includes('def '),
  'Inheritance':          a => a.includes('class ') && (a.includes('super(') || /class \w+\(\w+\)/.test(a)),
  'Lambda & Map':         a => a.includes('lambda') || a.includes('map(') || a.includes('filter('),
  'Decorators':           a => a.includes('@') || (a.includes('def ') && a.includes('wrapper')),
  'Final Project':        a => a.length > 80 && (a.includes('def ') || a.includes('for ') || a.includes('if ')),
}

const PASS_MESSAGES = [
  (topic) => `Great work! Your code demonstrates real understanding of ${topic}.`,
  (topic) => `Well done — you've got the ${topic} concepts down.`,
  (topic) => `That is the right idea. You used the key concepts from today's lesson on ${topic}.`,
]
const CLOSE_MESSAGES = [
  () => 'Compare yours with the example below — there are many valid approaches.',
  () => 'Your approach works too. The example shows one common way to solve it.',
]

export function gradeChallenge(answer, lesson) {
  const a = answer.trim()
  const ch = lesson.challenge
  const sol = ch.exampleSolution || ''

  // --- Guard: too short ---
  if (a.length < 5) {
    return {
      passed: false,
      feedback: 'Your answer is too short. Write actual Python code to solve the task.',
      hint: ch.hint,
    }
  }

  // --- Guard: unfilled blanks ---
  if (ch.difficulty === 'fill_blank' && a.includes('___')) {
    return {
      passed: false,
      feedback: 'You still have blanks left. Replace every ___ with real Python code.',
      hint: ch.hint,
    }
  }

  // --- Token similarity against example solution ---
  const solTokens = [
    ...new Set(
      (sol.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || []).filter(
        t => t.length >= 3 && !STOPWORDS.has(t)
      )
    ),
  ]
  const aLower = a.toLowerCase()
  const matched = solTokens.filter(t => aLower.includes(t.toLowerCase()))
  const tokenScore = solTokens.length > 0 ? matched.length / solTokens.length : 0.5

  // --- Topic structural check ---
  const topicFn = TOPIC_CHECKS[lesson.topic]
  const topicOk = topicFn ? topicFn(a) : true

  const passed = topicOk && (tokenScore >= 0.25 || a.length > 60)

  if (passed) {
    const msg = PASS_MESSAGES[Math.floor(Math.random() * PASS_MESSAGES.length)](lesson.topic)
    const close = tokenScore >= 0.6 ? '' : ' ' + CLOSE_MESSAGES[Math.floor(Math.random() * CLOSE_MESSAGES.length)]()
    return { passed: true, feedback: msg + close, hint: null }
  }

  // --- Failure: build specific message ---
  let feedback = 'Good try! '
  if (!topicOk) {
    feedback += `This challenge is about ${lesson.topic} — make sure you are using the relevant Python syntax. `
  } else {
    feedback += 'Check your logic against the task description. '
  }
  feedback += 'The hint below shows what is expected.'

  return { passed: false, feedback, hint: ch.hint }
}
