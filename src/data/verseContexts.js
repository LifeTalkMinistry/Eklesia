const VERSE_CONTEXTS = Object.freeze({
  'Genesis 50:20': 'Joseph is reassuring the brothers who sold him into slavery. He does not excuse their harmful intent, but he recognizes that God worked through the situation to preserve many lives during the famine.',
  'Exodus 14:14': 'Israel is trapped between the Red Sea and Pharaoh’s army. Moses tells the frightened people to stand firm because their rescue will come from God, not from their own ability to escape.',
  'Leviticus 19:18': 'This command appears within instructions about holy community life. Israel is told to reject revenge and lasting resentment and to treat a neighbor’s well-being as seriously as one’s own.',
  'Numbers 6:24': 'This is the opening line of the priestly blessing God gave Aaron and his sons to speak over Israel. The full blessing asks for God’s protection, favor, presence, and peace.',
  'Deuteronomy 6:5': 'Moses is preparing Israel to enter the promised land. Within the Shema, he calls the people to exclusive covenant loyalty to the one true God with their whole being.',
  'Joshua 1:9': 'God is commissioning Joshua after Moses’ death to lead Israel into the promised land. Joshua’s courage is grounded in God’s continuing presence, not in confidence that the task will be easy.',
  'Judges 6:12': 'Gideon is hiding from Midianite raiders when the angel of the Lord calls him a mighty warrior. The greeting begins God’s call to deliver Israel and speaks beyond Gideon’s present fear.',
  'Ruth 1:16': 'After both women are widowed, Naomi urges Ruth to return home. Ruth instead makes a costly pledge of loyalty to Naomi, her people, and her God.',
  '1 Samuel 16:7': 'Samuel is evaluating Jesse’s sons while looking for Israel’s next king. God corrects Samuel’s focus on outward appearance and directs him toward the heart, eventually leading him to David.',
  '2 Samuel 22:31': 'This statement comes from David’s song of praise after God delivered him from enemies and from Saul. David looks back on God’s way as trustworthy and God’s protection as proven.',
  '1 Kings 8:61': 'Solomon is concluding the dedication of the temple. After praying for God’s presence and mercy, he urges the people to remain wholeheartedly faithful and obedient.',
  '2 Kings 6:16': 'Elisha’s servant sees an enemy army surrounding the city and panics. Elisha knows that God’s unseen heavenly forces are greater, and the servant’s eyes are then opened to see them.',
  '1 Chronicles 16:11': 'David has brought the ark of the covenant to Jerusalem and appointed worship before it. The celebration song calls God’s people to seek his strength and presence continually.',
  '2 Chronicles 7:14': 'God is responding to Solomon after the temple dedication. The promise is addressed to his covenant people during seasons of judgment and calls them to humility, prayer, repentance, and renewed seeking.',
  'Ezra 7:10': 'This verse summarizes Ezra’s preparation before he teaches others. He commits himself first to studying God’s instruction, then to living it, and only then to teaching it in Israel.',
  'Nehemiah 8:10': 'The returned exiles have heard God’s law read aloud and begin to weep. Their leaders tell them that the day is holy and should become a day of shared celebration, because joy in the Lord gives strength.',
  'Esther 4:14': 'Mordecai is urging Esther to approach the king while her people face destruction. He challenges her to consider whether her royal position has placed her in a unique moment of responsibility.',
  'Job 19:25': 'Job speaks while suffering deeply and while his friends continue to accuse him. In the middle of confusion, he expresses confidence that a living redeemer or vindicator will ultimately stand for him.',
  'Psalms 46:10': 'Psalm 46 describes God as a refuge while nations rage and the earth feels unstable. The command is to stop striving and recognize God’s sovereignty over every conflict and nation.',
  'Proverbs 3:5': 'A father is giving wisdom for a life directed by God. Trusting the Lord is contrasted with treating one’s limited understanding as the final guide for every decision.',
  'Ecclesiastes 3:1': 'This verse introduces a poem describing many contrasting seasons of human life—birth and death, grief and joy, building and tearing down. The passage reflects on human limits and the ordered times people cannot fully control.',
  'Song of Solomon 8:7': 'Near the climax of the song, love is described as enduring through overwhelming forces and as something wealth cannot purchase. The verse celebrates loyal, wholehearted love rather than temporary attraction.',
  'Isaiah 41:10': 'God speaks reassurance to Israel, his chosen servant, while the surrounding nations and the threat of exile create fear. The promise emphasizes God’s presence, help, strength, and sustaining hand.',
  'Jeremiah 29:13': 'Jeremiah is writing to Judean exiles living in Babylon. They are told to settle faithfully during a long exile, while trusting that God will restore them in his time and will be found when they seek him wholeheartedly.',
  'Lamentations 3:22': 'The poet is grieving Jerusalem’s destruction and describing severe suffering. In the center of that lament, he deliberately turns his attention toward God’s steadfast love, compassion, and daily mercy.',
  'Ezekiel 36:26': 'God is promising restoration to an exiled and spiritually unfaithful Israel. The new heart and spirit describe an inner renewal that enables the people to respond to God with willing obedience.',
  'Daniel 3:17': 'Shadrach, Meshach, and Abednego are answering King Nebuchadnezzar before being thrown into the fiery furnace. They affirm that God is able to rescue them, while the following verse shows they will remain faithful even if he does not.',
  'Hosea 6:6': 'God is confronting Israel’s shallow and short-lived repentance. Religious sacrifices are not a substitute for steadfast covenant love, mercy, and a genuine knowledge of God.',
  'Joel 2:13': 'Joel is calling Judah to genuine repentance as the day of the Lord approaches. Tearing the heart rather than clothing means returning inwardly and honestly to the God who is gracious and compassionate.',
  'Amos 5:24': 'God has rejected worship gatherings that continue alongside exploitation and injustice. The image of a flowing river calls for righteousness and justice to become constant features of community life.',
  'Obadiah 1:15': 'Obadiah announces judgment against Edom for pride and violence toward Judah. The day of the Lord means that nations, including Edom, will face the consequences of how they have treated others.',
  'Jonah 2:2': 'Jonah is praying from inside the great fish after fleeing God and being thrown into the sea. He recounts how he cried out from extreme distress and how God heard him.',
  'Micah 6:8': 'The chapter presents a covenant dispute in which Israel asks what offering could satisfy God. The answer redirects attention from impressive rituals toward justice, faithful mercy, and humble life with God.',
  'Nahum 1:7': 'Nahum announces judgment on the oppressive city of Nineveh. Within that severe message, this verse affirms that God remains good and a secure refuge for those who trust him.',
  'Habakkuk 2:4': 'God is answering Habakkuk’s complaint about violent and arrogant powers. While the proud oppressor will not endure, the righteous person is called to live faithfully while waiting for God’s promised justice.',
  'Zephaniah 3:17': 'After strong warnings of judgment, Zephaniah describes restoration for a humble remnant. God is pictured as present among his people, saving them and rejoicing over them with tender delight.',
  'Haggai 1:5': 'The returned exiles have focused on their own houses while God’s temple remains neglected. Haggai asks them to examine why their busy efforts are producing so little and to reconsider their priorities.',
  'Zechariah 4:6': 'The angel is explaining a vision to Zerubbabel, who is responsible for rebuilding the temple. The work will be completed through God’s Spirit rather than by political strength or human force alone.',
  'Malachi 3:6': 'God is confronting Israel’s unfaithfulness and calling the people to return. Their continued existence rests on God’s unchanging covenant character, not on their consistent faithfulness.',
  'Matthew 6:33': 'Jesus is teaching in the Sermon on the Mount about anxiety over food, clothing, and tomorrow. Seeking God’s kingdom first means trusting the Father while making his rule and righteousness the governing priority.',
  'Mark 10:45': 'The disciples have been arguing about status and greatness. Jesus overturns their model of leadership by pointing to service and to his own mission of giving his life for others.',
  'Luke 1:37': 'The angel Gabriel has announced that Mary will conceive Jesus and that her relative Elizabeth has also conceived unexpectedly. The statement reassures Mary that no promise spoken by God is powerless to be fulfilled.',
  'John 15:5': 'During his farewell teaching before the crucifixion, Jesus uses the image of a vine and branches. His disciples can bear lasting spiritual fruit only by remaining dependent on and connected to him.',
  'Acts 20:35': 'Paul is saying farewell to the Ephesian elders. He points to his own work and care for the weak, then reminds them that Christian leadership should be marked by generous giving rather than personal gain.',
  'Romans 12:2': 'Paul is moving from explaining the gospel to describing a transformed way of life. Believers are called to resist the patterns of the present age and allow renewed thinking to shape their discernment and conduct.',
  '1 Corinthians 13:4': 'Paul is correcting a church divided by pride and competition over spiritual gifts. His description of love shows the character without which even impressive gifts and sacrifices become empty.',
  '2 Corinthians 5:17': 'Paul is explaining the new reality created through Christ’s death and resurrection. Those who belong to Christ are part of God’s work of reconciliation and are no longer defined only by the old order.',
  'Galatians 5:22': 'Paul contrasts the destructive works of self-directed desire with the character produced by the Holy Spirit. The fruit is evidence of a life learning to walk in the freedom and guidance of the Spirit.',
  'Ephesians 2:10': 'Paul has just emphasized that salvation is God’s gift of grace rather than a human achievement. Good works do not earn salvation; they are the purposeful life God prepares for people who have been made new in Christ.',
  'Philippians 4:6': 'Writing from imprisonment, Paul has urged the church to rejoice and live with gentleness. Anxiety is answered by bringing specific requests to God with thanksgiving, leading into the promise of God’s guarding peace.',
  'Colossians 3:23': 'This instruction appears within household relationships and is first addressed to servants. It calls for sincere work done before the Lord rather than performance motivated only by human observation or approval.',
  '1 Thessalonians 5:16': 'Paul closes his letter to a young church facing pressure with a series of brief practices: rejoice, pray continually, and give thanks. These habits help sustain a community waiting faithfully for Christ.',
  '2 Thessalonians 3:3': 'Paul acknowledges opposition from unreliable and harmful people. He contrasts their faithlessness with the dependable character of the Lord, who strengthens and guards his people.',
  '1 Timothy 4:12': 'Timothy is a relatively young leader confronting false teaching. Paul tells him not to depend on age for authority but to make his speech, conduct, love, faith, and purity a credible example.',
  '2 Timothy 1:7': 'Paul is encouraging Timothy not to shrink back from suffering or become ashamed of the gospel. The Spirit God gives produces power, love, and disciplined judgment rather than controlling fear.',
  'Titus 2:11': 'After giving instructions for sound and honorable conduct, Paul explains their foundation. God’s saving grace not only appears to rescue people; it also trains them to reject ungodliness and live differently.',
  'Philemon 1:6': 'Paul is praying for Philemon while preparing to appeal for Onesimus, an enslaved man who has become a Christian brother. Shared faith should become active and deepen recognition of the good Christ produces among believers.',
  'Hebrews 4:12': 'The writer has warned readers through Israel’s wilderness failure and urged them to enter God’s rest. God’s living word exposes the heart and prepares for the reminder that every person is accountable before him.',
  'James 1:22': 'James has told believers to receive God’s word humbly. He then warns that hearing without obedience creates self-deception, comparing it to looking in a mirror and immediately forgetting what was seen.',
  '1 Peter 5:7': 'Peter is closing a letter to Christians suffering social pressure and hardship. Casting anxiety on God belongs to humble trust under his care and is followed by a call to remain alert and resist the devil.',
  '2 Peter 3:9': 'Some people are mocking the apparent delay of Christ’s return. Peter explains that the delay reflects God’s patience and desire to give people opportunity to repent, not an inability to keep his promise.',
  '1 John 4:19': 'John is explaining that God is love and that believers have first received love from him. Christian love is therefore a response to God’s initiative and must become visible in love for other people.',
  '2 John 1:6': 'The elder is encouraging believers to remain in truth while warning about deceivers. Love is not separated from obedience; it is lived by walking according to God’s commands.',
  '3 John 1:4': 'The elder expresses joy that Gaius and other believers are walking faithfully in the truth. The statement introduces praise for Gaius’s practical hospitality and support of traveling Christian workers.',
  'Jude 1:22': 'After warning the church about corrupt teachers, Jude gives different responses for people being affected. Those who doubt should be met with patient mercy rather than immediate condemnation.',
  'Revelation 21:5': 'John is seeing the new heaven, new earth, and New Jerusalem after final judgment. God declares that the broken order is being renewed and commands John to record the promise as trustworthy and true.',
});

function startingReference(devotion) {
  if (!devotion?.bookName || !devotion?.chapter) return devotion?.reference || '';
  const verse = devotion.verseStart ?? devotion.startVerse ?? devotion.verse;
  return verse ? `${devotion.bookName} ${devotion.chapter}:${verse}` : devotion.reference || '';
}

export function getVerseContext(devotion) {
  const reference = startingReference(devotion);
  return VERSE_CONTEXTS[reference]
    || `This verse appears within ${devotion?.bookName || 'this Bible book'} ${devotion?.chapter || ''}. Reading the nearby verses helps show how it fits into the larger story, poem, teaching, or argument.`;
}

export default VERSE_CONTEXTS;
