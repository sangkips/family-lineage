# How to use the register

Anyone in the family can add a relative without an account. One admin checks every
entry before it reaches the tree. That is the whole system.

---

## Part one — anyone in the family

**You do not need an account.** No sign-up, no password, no app to install. Open the
link on your phone and you can add people the same minute.

### Finding your place

The first time you open the register it asks **Find yourself in the register**. Type
your name and tap it. The tree is then drawn around you: your own card turns solid and
reads **YOU**, and every other card gains a strip along its bottom saying how that
person stands to you — grandfather, wife, niece.

If your name is not there yet, tap **Just browse the tree** and add yourself afterwards.
You can change whose view it is at any time with the **You are … · change** button in
the corner.

### Reading the tree

| Thing | Meaning |
| --- | --- |
| Card colour | The stripe along the top of each card marks the generation. Deep blue is the oldest generation on record, warming through green and gold to pink at the youngest. |
| Pink line | A recorded marriage joining two people. A faint dashed line means the couple was only guessed from sharing a child — record the marriage and it becomes solid. |
| `+4` badge | A branch folded away, with the number of people hidden inside it. Tap to open it; tap the `−` to fold it back. |
| Show everyone | Opens every folded branch at once. Slow on a phone with a big family. |
| Search | The box at the top. Two letters is enough; tap a result and the tree jumps to that person and opens the branch they are in. |
| Dotted card | An entry still waiting for review. Only the admin sees these — to everyone else it is not on the tree at all. |

### Opening a person

Tap any card. A sheet slides up from the bottom with their birth year and place, whether
they are living, and any notes recorded about them — then their marriages, parents,
brothers and sisters, and children. Tapping a marriage opens that couple's own page.

Three buttons sit at the foot of the sheet, and they are how everything gets added.

### Adding a child

Open the parent's card and tap **Add a child under …**. You will not be asked who the
parents are — if that person is married, both parents are filled in for you.

1. Enter the child's first and last name.
2. Enter a birth year. A year alone is fine and is what most people have; tick
   **I know the exact date** only if you really do.
3. Add gender and birthplace if you know them. Both optional.
4. Tap **Send for approval**.

If someone has married twice, the form asks which household the child belongs to and
lists the spouses. One tap — no searching.

### Adding someone who is not a child of anyone on the tree

Use **Add a person** at the top of the screen. Here you do have to say who the parents
are, because a person with no connection cannot be placed on a family tree. Search the
register for each parent, or tap **Parent is not in the tree — enter their details** and
type them in. Two parents at most.

### Recording a marriage

Open either partner and tap **Record a marriage**. Search for the spouse, or — if they
married into the family and are not in the register — tap **Not in the register — they
married into the family** and enter them there. The marriage itself is what connects
them, so they do not need parents on record.

Add the year they married. If the marriage has ended, tick the box and give the year and
whether it ended by death or divorce.

Once a marriage exists the button reads **Edit marriage** instead, and you can correct
the dates or record a second marriage.

### Fixing something that is wrong

**Suggest a correction** on any card. The form opens filled in with what the register
currently holds; change what is wrong and send it. Only the fields you actually changed
are submitted, and the person on the tree is untouched until the admin agrees.

### A couple's own page

Tapping a marriage opens the household: both partners, when they married and when it
ended, then their children, grandchildren and great-grandchildren, each generation
counted. Where one partner has children from another relationship, those are listed
separately at the foot — part of the household, but never counted as the couple's own.

### After you send something

You will see a thank-you and nothing else. There is no tracking link and no email — the
register collects nothing about you, so it has no way to write back. Your entry appears
on the tree when the admin approves it. If you got something wrong, wait until it appears
and then send a correction.

### What the register will not accept

- **A person floating on their own.** Everyone needs at least one parent or a marriage,
  or they cannot be placed.
- **More than two parents** on one person.
- **A loop.** Nobody can end up as their own ancestor, however the entry is worded.
- **A silent duplicate.** If the name you enter already exists, the entry still goes
  through but is flagged for the admin, who links it to the existing person instead of
  creating a second one.

---

## Part two — the admin

**Nothing is public until you say so.** Accounts exist for one purpose: reviewing what
the family sends in. There is nothing else to administer.

### Signing in

Go to `/login` and sign in. You land straight on the queue. Your email address must be in
`ADMIN_EMAILS` on the server — an account created any other way can sign in but sees the
ordinary tree and nothing more.

Once signed in, the menu in the top corner carries **Moderation queue** and **Sign out**.

### Reading the queue

One line per submission: the name it concerns, and what kind of change it is — **New
entry**, **Correction** or **Marriage**. That is deliberately all, because a queue is
read by scanning names.

A gold `!` beside a name means somebody with that name is already in the register. Open
it before approving, or you will end up with two of the same person.

### Reviewing one submission

1. **Tap the name.** The row opens: who the parents are, or the marriage dates, or
   exactly which fields a correction changes — plus when it arrived and a short source
   tag.
2. **Fix it before you approve it.** First name, last name, birth year and birthplace
   are all editable right there. Correct the spelling rather than rejecting an entry over
   a typo.
3. **Deal with any duplicate.** If a match is offered, tap **Link to existing**. On
   approval the child's link is re-pointed to the person already on the tree and the
   duplicate is dropped. This is the only cheap moment to do it — once a duplicate has
   children and a biography hanging off it, it is not.
4. **Add a note** if you want a record of your reasoning. Optional.
5. **Decide.** The `⋯` menu at the right of the row holds **Approve** and **Reject**.

**Approve** publishes the entry to everyone, applies your edits, and carries out any
merge. **Reject** keeps the record for the audit trail but never shows it on the tree; a
rejected correction simply disappears and the person is left as they were.

### Approving a marriage does one thing more

When you approve a marriage, the husband becomes the father of every child his wife
already had. This is the household as the family lives it, not biology. See
[`src/lib/household.ts`](../src/lib/household.ts).

It runs one way only. A wife never takes on the children a husband had before her — those
stay listed under him, and show on the couple's page as his children from another
relationship. The rule is skipped rather than guessed at if the couple's genders are not
recorded, and it will never create a loop.

### People connected to nobody

Below the queue is **Not connected to anyone**: people with no parent, no child and no
marriage. New entries can no longer be saved this way, so anything here is left over from
earlier.

Each shows the birth year, when it was added, and a link to see the record on the tree.
Deleting takes two taps. Where someone of the same name exists elsewhere in the tree with
relatives, the row says so outright — deleting this one leaves that one untouched.

### What only you can see

- Entries awaiting review, drawn on the tree as dotted gold cards.
- The birth dates of living people who have them hidden.
- Living people who are withheld from search by name.

New living people are created with their birth date hidden by default. Everyone else sees
the tree with those details removed, not blanked out.

### Worth knowing

- **Anyone can submit.** The form is open to the internet, with no rate limit and no
  CAPTCHA. If it is ever flooded, the source tag on each row lets you reject a whole
  burst as one batch rather than clicking through it. The tag only exists when
  `SUBMITTER_SALT` is set.
- **The privacy switches have no button yet.** Hiding a living person's birth date or
  name is supported by the data model and the API but cannot be toggled from the screen —
  only the default applies.
- **Approving is not final.** Anything approved can be corrected afterwards through the
  same review flow.
