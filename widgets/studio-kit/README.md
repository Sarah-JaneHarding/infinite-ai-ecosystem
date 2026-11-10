# Studio and Board Intake: how to use

## In every widget: the Studio panel (section 4)

1. Run the widget (or press Load synthetic sample, then Run).
2. **Document view.** The output is laid out as a document with tables. Click any text to change it. Give a reason and press **Save my edits**. A saved edit makes a new schema revision.
3. **File view.** The same output as JSON, a table (.csv), a document (.md) or a web page (.html). JSON and CSV can be edited and read back; all four can be downloaded.
4. **Agent contract.** Shows the agent from the repo and checks the output, laid out the way the agent asks, against that agent's own schema. Adapters exist for **PD-W01 to PD-W08, TB-W01 to TB-W11 and DW-W01 to DW-W04** (23 widgets); all pass the repo's schema. Where a widget cannot supply something the agent needs, it says "needs input" and names it, and you type the missing detail in the panel (for example the reading grade and target band for TB widgets, the period dates for PD-W01, the differentiation tier for TB-W01). Nothing is guessed. TB-W03 stays "needs input" because the CAPS level names ("Routine procedures", "Problem solving") are not the agent's level list; that mapping is a policy decision. The **other 23 widgets with agents** (all SA, CE, and DW-W07 to W09) cannot be laid out from a widget: MOD-02 and DW-W07 to W09 results name platform record ids (OQ-040) and CE results cite ratified source documents by id, version and clause (OQ-041). The panel says so and lists what the agent asks for.
5. **Revision and ratification.** The signed-in person presses **Ratify this revision**. When the platform supplies the signed-in identity, the name is locked to it and the account id is recorded. With no sign-in the name is typed, the package is marked unverified and the registry will refuse it. Codes like T04 and single words are refused. Only then is **Send to code** enabled. It downloads a release package (`<widget>-release-vX.Y.Z.json`) holding the new manifest, output schema, example output, contract result, the ratifier and the reason.
6. **Versions and rollback.** Load earlier release packages. **Roll back to this** needs a name and a reason and makes a new forward revision that restores the old content. A named person must ratify it like any other change. History is never rewritten.

Nothing is stored or sent. The release package is a file you hand to the Wiring Board or commit to the registry.

## In the Wiring Board: Custom widgets (section 5)

- **A. Add and audit.** Load the widget file and its agent contract. The audit checks: the widget contract, POPIA (purpose, retention, no personal information), boundaries (no network calls, `eval`, outside addresses), standing rules (no teacher ranking or scoring), and the agent contract (version, purpose, input and output schema, `pii_guard` guardrail, budget, `requiresApproval`, at least three rules, at least one boundary, and a Brain-writing agent must require approval).
- **B. Alert the SMT and ratify.** Name at least two SMT members. The page makes an alert file (it cannot send it). Each member types their own name to ratify.
- **C. Publish.** Private stays in the school and is loaded into the board for testing and wiring. Public first needs a school-information clean: list the school name, town, staff names and anything else identifying; the page removes those words (and e-mail addresses, phone numbers, ID-style numbers and web addresses from the widget's own part), checks the audit still passes, and one named SMT member confirms the cleaned version. The offer file records only how many items were removed, never the words. It is marked *submitted for platform review* (not live). A word list cannot find every school detail, so read the example data yourself.
- **D. Offers to this school.** Load an offer file (another school's widget or a new platform feature). It is audited again on arrival. This school's named person accepts or rejects, with a reason; the decision is a file. Accepting loads the widget into the board, where it is tested, edited in its own Studio panel to the school's template, ratified and wired.

## In the repo (PR #161)

`packages/widget-registry` holds the rules as tested TypeScript, `docs/WIDGET_REGISTRY_DESIGN.md` explains them, and `docs/OPEN_QUESTIONS.md` has OQ-037 to OQ-041 (OQ-037 to OQ-039 decided: public sharing with school information removed (OQ-037), the signed-in account as the person on record (OQ-038), and review by Infinite-AI appointed staff before anything goes public (OQ-039); OQ-040 and OQ-041 are new and open).
