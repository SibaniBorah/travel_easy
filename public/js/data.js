/**
 * Chalo NorthEast - Data & Constants
 */

const NE_CONSTANTS = {
  STATES: {
    AS: { name: "Assam", capital: "Dispur (Guwahati)", code: "AS", color: "#10b981", hub: "Guwahati" },
    ML: { name: "Meghalaya", capital: "Shillong", code: "ML", color: "#06b6d4", hub: "Shillong" },
    AR: { name: "Arunachal Pradesh", capital: "Itanagar", code: "AR", color: "#6366f1", hub: "Tezpur / Naharlagun" },
    NL: { name: "Nagaland", capital: "Kohima", code: "NL", color: "#f59e0b", hub: "Dimapur" },
    MN: { name: "Manipur", capital: "Imphal", code: "MN", color: "#ec4899", hub: "Imphal" },
    MZ: { name: "Mizoram", capital: "Aizawl", code: "MZ", color: "#14b8a6", hub: "Aizawl / Silchar" },
    TR: { name: "Tripura", capital: "Agartala", code: "TR", color: "#f43f5e", hub: "Agartala" },
    SK: { name: "Sikkim", capital: "Gangtok", code: "SK", color: "#3b82f6", hub: "Siliguri / NJP / Gangtok" }
  },

  LINGO_DICTIONARY: [
    {
      language: "Assamese",
      state: "Assam",
      phrases: [
        { phrase: "Nomoskar", meaning: "Hello / Greetings", pronunciation: "noh-moh-shkar" },
        { phrase: "Kiba dorkar asey neki?", meaning: "Do you need any help?", pronunciation: "kee-bah dor-kar ah-say neh-kee" },
        { phrase: "Bhal lagil", meaning: "I liked it / Very nice", pronunciation: "bhal lah-geel" },
        { phrase: "Eitu kiman?", meaning: "How much is this?", pronunciation: "ay-too kee-man" },
        { phrase: "Dhonnyobad", meaning: "Thank you", pronunciation: "dhon-yoh-bad" }
      ]
    },
    {
      language: "Khasi",
      state: "Meghalaya",
      phrases: [
        { phrase: "Khublei", meaning: "Hello & Thank you (all-in-one)", pronunciation: "khoo-blay" },
        { phrase: "Kumno phi long?", meaning: "How are you?", pronunciation: "koom-no fee long" },
        { phrase: "Nga biang", meaning: "I am fine", pronunciation: "nga bee-ang" },
        { phrase: "Katam kane?", meaning: "How much does this cost?", pronunciation: "kah-tam kah-nay" },
        { phrase: "Khublei shibun", meaning: "Thank you very much", pronunciation: "khoo-blay shee-boon" }
      ]
    },
    {
      language: "Nagamese",
      state: "Nagaland",
      phrases: [
        { phrase: "Kiba khobor?", meaning: "What's the news / How are you?", pronunciation: "kee-bah khoh-bor" },
        { phrase: "Bhal asey", meaning: "I'm doing well", pronunciation: "bhal ah-say" },
        { phrase: "Eitu kiman dam?", meaning: "How much does this cost?", pronunciation: "ay-too kee-man dahm" },
        { phrase: "Shukriya / Dhanyabad", meaning: "Thank you", pronunciation: "shook-ree-yah" },
        { phrase: "Aapni kuntu jaga jabo?", meaning: "Where are you going?", pronunciation: "ahp-nee koon-too jah-gah jah-boh" }
      ]
    },
    {
      language: "Mizo",
      state: "Mizoram",
      phrases: [
        { phrase: "Chibai", meaning: "Hello / Greetings", pronunciation: "chee-bye" },
        { phrase: "I dam em?", meaning: "How are you?", pronunciation: "ee dahm em" },
        { phrase: "Ka dam e", meaning: "I am fine", pronunciation: "kah dahm ay" },
        { phrase: "Ka lawm e", meaning: "Thank you", pronunciation: "kah lawm ay" },
        { phrase: "Hei hi engzat man nge?", meaning: "How much is this?", pronunciation: "hay hee eng-zaht mahn ngay" }
      ]
    }
  ],

  EMERGENCY_CONTACTS: [
    { service: "National All-in-One Emergency", number: "112", description: "Police, Fire, Ambulance 24x7" },
    { service: "Tourist Police Helpline", number: "1363", description: "Toll-free multi-lingual tourist assistance" },
    { service: "Women Helpline", number: "1091", description: "Emergency assistance for female travelers" },
    { service: "Assam Police Control", number: "0361-2450555", description: "Guwahati HQ" },
    { service: "Meghalaya Police Control", number: "0364-2222214", description: "Shillong HQ" },
    { service: "Arunachal Police Control", number: "0360-2212233", description: "Itanagar HQ" },
    { service: "Sikkim Tourism Assistance", number: "03592-202634", description: "MG Marg Gangtok Counter" }
  ]
};
