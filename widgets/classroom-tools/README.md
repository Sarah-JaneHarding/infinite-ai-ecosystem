# Classroom Tools (TB-W14 to TB-W20): how to use

Seven tools for the whiteboard, tablet or laptop. They cover the same jobs as the tools in the Pink Cat Studio PDF. The code, colours and pictures are my own. Nothing from Pink Cat is used.

| File | Tool | Pink Cat tool it replaces |
|---|---|---|
| `INFINITE-AI-TB-W14.html` | Class Register and Lunch Count | Attendance with optional lunch count |
| `INFINITE-AI-TB-W15.html` | Random Student Picker | Random Student Picker |
| `INFINITE-AI-TB-W16.html` | Random Group Maker | Random Group Maker |
| `INFINITE-AI-TB-W17.html` | Rotations Timer | Rotations Timer |
| `INFINITE-AI-TB-W18.html` | Score Keeper | Score Keeper |
| `INFINITE-AI-TB-W19.html` | Noise Levels | Noise Levels Manager |
| `INFINITE-AI-TB-W20.html` | Survey and Graph | Survey and Graph |

## To use one in class

1. Double-click the file. It opens in Chrome, Edge, Firefox or Safari. No internet is needed, and nothing is installed.
2. Press **Load synthetic sample** to see it working with pretend data.
3. Type your own class list in section 2. One learner per line, as a **code** with a number (L01, L02 ...). After a bar you may add a label that shows on the board, for example `L01 | Lion`. A name typed where a code goes is refused on purpose.
4. Use the coloured board. Press **Full screen for the board** to fill the whiteboard. Pick a theme (Veld, Ocean, Sunrise, Night sky).
5. When you want a record, press **Run**. Read the summary, choose your role, and press **Approve**. Nothing is passed on until you approve.

## What each tool does

- **Register and lunch:** tap a card once for present, again for the next lunch choice, then absent, then unmarked. The summary has counts and codes only. It is not the official register.
- **Picker:** each learner who has not had a turn has an equal chance. It remembers turns. Take a learner out (away today) and add them back. Start a new round at any time.
- **Group maker:** 2 to 30 groups, sizes differ by at most one, learners who are away are left out, and you can name pairs who must be kept apart. Rename the groups in any language.
- **Rotations timer:** up to 10 rounds, optional clean-up after each, seven end-of-round sounds, and a shrinking disc for young learners.
- **Score keeper:** 2 to 6 teams, a step of 1, 2, 5, 10 or more, plus and minus. Use team names, not learner names.
- **Noise levels:** up to 5 levels written in any language. Touch a level to make it active. The Attention button plays a sound. **No microphone is used.**
- **Survey and graph:** a question with 2 to 4 choices. You tap for each hand that goes up. Show or hide the bar graph. Only counts are kept.

Every tool also has an optional timer, except the Rotations Timer, which is itself a timer.

## Privacy

- Only learner codes and counts go into the summary. The label you type for the board never leaves the page.
- Nothing is saved. Download the approved output before you close the page.
- The pages make no network calls. The sounds are made by the browser.

## To load them into the Wiring Board (ingest)

1. Open the Wiring Board (`INFINITE-AI-PF-W06.html`).
2. In the file box at the top, choose all seven files (hold Ctrl or Command to pick several). Label each one **SOURCE DOCUMENT** when asked.
3. Each shows **MANIFEST OK**, accepts no upstream event, emits its own event (`tb.register.recorded`, `tb.picker.session`, `tb.groups.formed`, `tb.rotations.run`, `tb.scores.recorded`, `tb.noise.session`, `tb.survey.tallied`) and names Teacher as the approving role.

These are platform widgets, so the Board's **Custom widgets** section (for school-made widgets with a CW- id) correctly refuses their TB- ids. That section now also accepts a school-made widget that declares `agentId: null` (no AI agent) without an agent contract file; the no-network and no-dynamic-code checks still apply.

## What is not here

A microphone sound meter, a live poll on learners' own devices, and birthday display were left out on purpose. `toolbox-catalogue.md` explains each and lists the other 57 tools worth replicating, with a suggested order.

## Tests

- Each tool passes the standard checks (manifest, envelope, gate, break test, fire once, change after approval, personal information, accessibility, 390 px wide phone).
- 70 board checks drive the real pages: fair picking with no repeats, even group sizes over 60 draws, keep-apart rules, timer pause, sounds, limits (11 rounds, 7 teams, 6 levels, 5 choices all refused), and name, phone and ID numbers blocked from approval.
