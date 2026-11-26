import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  // .env may not exist in production where env vars are injected
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Single Admin User
  const adminEmail = process.env.ADMIN_EMAIL || "admin@newsportal.in";
  let adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminHash) {
    console.warn("ADMIN_PASSWORD_HASH not set in env; using default dev password 'Admin@123456'.");
    adminHash = bcrypt.hashSync("Admin@123456", 10);
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
    },
  });

  // 2. Main Categories + MP City Sub-categories
  const mainCategories = [
    { name: "मध्य प्रदेश", slug: "madhya-pradesh", order: 1 },
    { name: "देश", slug: "india", order: 2 },
    { name: "विदेश", slug: "world", order: 3 },
    { name: "खेल", slug: "sports", order: 4 },
    { name: "बिजनेस", slug: "business", order: 5 },
    { name: "मनोरंजन", slug: "entertainment", order: 6 },
    { name: "टेक्नोलॉजी", slug: "technology", order: 7 },
    { name: "विचार", slug: "opinion", order: 8 },
  ];

  const catMap = new Map<string, string>();
  for (const cat of mainCategories) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, order: cat.order },
      create: cat,
    });
    catMap.set(cat.slug, record.id);
  }

  const mpId = catMap.get("madhya-pradesh")!;
  const mpCities = [
    { name: "भोपाल", slug: "bhopal", order: 1 },
    { name: "इंदौर", slug: "indore", order: 2 },
    { name: "ग्वालियर", slug: "gwalior", order: 3 },
    { name: "जबलपुर", slug: "jabalpur", order: 4 },
    { name: "उज्जैन", slug: "ujjain", order: 5 },
    { name: "सागर", slug: "sagar", order: 6 },
    { name: "रीवा", slug: "rewa", order: 7 },
    { name: "रतलाम", slug: "ratlam", order: 8 },
  ];

  for (const city of mpCities) {
    const record = await prisma.category.upsert({
      where: { slug: city.slug },
      update: { name: city.name, order: city.order, parentId: mpId },
      create: { ...city, parentId: mpId },
    });
    catMap.set(city.slug, record.id);
  }

  // 3. Tags
  const tagDefs = [
    { name: "मध्य प्रदेश", slug: "madhya-pradesh" },
    { name: "भोपाल", slug: "bhopal" },
    { name: "इंदौर", slug: "indore" },
    { name: "विकास", slug: "vikas" },
    { name: "क्रिकेट", slug: "cricket" },
    { name: "टेक्नोलॉजी", slug: "technology" },
    { name: "अर्थव्यवस्था", slug: "economy" },
    { name: "शिक्षा", slug: "education" },
  ];
  const tagMap = new Map<string, string>();
  for (const t of tagDefs) {
    const rec = await prisma.tag.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: t,
    });
    tagMap.set(t.slug, rec.id);
  }

  // 4. 20 Sample Hindi Articles (only seed if database has no articles yet)
  const existingArticlesCount = await prisma.article.count();
  const now = Date.now();
  const sampleArticles = existingArticlesCount > 0 ? [] : [
    {
      title: "भोपाल मेट्रो के दूसरे चरण का ट्रायल रन सफल, यात्रियों के लिए जल्द खुलेगा नया कॉरिडोर",
      slug: "bhopal-metro-second-phase-trial-run-successful",
      subtitle: "सुभाष नगर से एम्स तक के रूट पर तेज रफ्तार के साथ दौड़ी मेट्रो ट्रेन",
      excerpt: "राजधानी भोपाल में मेट्रो रेल परियोजना के दूसरे चरण का तकनीकी ट्रायल सफलतापूर्वक पूरा कर लिया गया है।",
      categorySlug: "bhopal",
      isFeatured: true,
      isBreaking: true,
      views: 12450,
      aiAssisted: true,
      aiSummary: "• भोपाल मेट्रो के दूसरे चरण का तकनीकी ट्रायल सफलतापूर्वक पूरा हुआ।\n• सुभाष नगर से एम्स रूट पर सिग्नलिंग और ब्रेकिंग सिस्टम की जांच सफल रही।\n• अगले दो महीनों में आम यात्रियों के लिए कमर्शियल संचालन शुरू होने की उम्मीद है।",
      tags: ["madhya-pradesh", "bhopal", "vikas"],
    },
    {
      title: "इंदौर ने फिर रचा इतिहास: स्वच्छता सर्वेक्षण में डिजिटल कचरा प्रबंधन बना नया मॉडल",
      slug: "indore-sets-new-benchmark-in-digital-waste-management",
      subtitle: "देश के कई बड़े शहरों के प्रतिनिधि इंदौर का वेस्ट-टू-वेल्थ मॉडल देखने पहुंचे",
      excerpt: "इंदौर नगर निगम ने एआई-आधारित कचरा निगरानी प्रणाली लागू कर शहरी स्वच्छता में नया मानक स्थापित किया है।",
      categorySlug: "indore",
      isFeatured: true,
      isBreaking: false,
      views: 9820,
      aiAssisted: true,
      aiSummary: "• इंदौर नगर निगम ने कचरा संग्रहण वाहनों की एआई निगरानी शुरू की।\n• गीले कचरे से बायो-सीएनजी उत्पादन में 20% की बढ़ोतरी दर्ज की गई।\n• अन्य राज्यों के नगर निकाय इस मॉडल को अपनाने का अध्ययन कर रहे हैं।",
      tags: ["madhya-pradesh", "indore", "vikas"],
    },
    {
      title: "उज्जैन महाकाल लोक में श्रद्धालुओं की सुविधा के लिए नई ई-कार्ट और क्राउड मैनेजमेंट प्रणाली लागू",
      slug: "ujjain-mahakal-lok-new-e-cart-and-crowd-management-system",
      subtitle: "त्योहारी सीजन से पहले मंदिर प्रशासन ने जारी की नई गाइडलाइन",
      excerpt: "महाकालेश्वर मंदिर और महाकाल लोक परिसर में बुजुर्गों और दिव्यांग श्रद्धालुओं के लिए निशुल्क ई-कार्ट सेवा बढ़ाई गई है।",
      categorySlug: "ujjain",
      isFeatured: true,
      isBreaking: false,
      views: 8310,
      aiAssisted: false,
      aiSummary: null,
      tags: ["madhya-pradesh", "vikas"],
    },
    {
      title: "ग्वालियर में नए आईटी पार्क के लिए 150 एकड़ जमीन आवंटित, हजारों युवाओं को मिलेगा रोजगार",
      slug: "gwalior-new-it-park-150-acres-allotted-employment",
      subtitle: "स्टार्टअप और सॉफ्टवेयर कंपनियों को मिलेंगी विशेष रियायतें",
      excerpt: "ग्वालियर अंचल में आईटी सेक्टर को बढ़ावा देने के लिए राज्य सरकार ने नए टेक्नोलॉजी पार्क की मंजूरी दे दी है।",
      categorySlug: "gwalior",
      isFeatured: true,
      isBreaking: false,
      views: 6420,
      aiAssisted: false,
      aiSummary: null,
      tags: ["madhya-pradesh", "technology", "vikas"],
    },
    {
      title: "जबलपुर में नर्मदा तट के सौंदर्यीकरण और रिवरफ्रंट प्रोजेक्ट को मिली कैबिनेट की मंजूरी",
      slug: "jabalpur-narmada-riverfront-project-cabinet-approval",
      subtitle: "ग्वारीघाट से तिलवारा घाट तक बनेगा आधुनिक पैदल पथ और ग्रीन जोन",
      excerpt: "संस्कारधानी जबलपुर में पर्यटन को नई उड़ान देने के लिए नर्मदा रिवरफ्रंट विकास योजना को हरी झंडी मिल गई है।",
      categorySlug: "jabalpur",
      isFeatured: true,
      isBreaking: false,
      views: 5890,
      aiAssisted: false,
      aiSummary: null,
      tags: ["madhya-pradesh", "vikas"],
    },
    {
      title: "रीवा सोलर पावर प्लांट से रेलवे को मिलेगी सस्ती बिजली, क्षमता विस्तार का काम शुरू",
      slug: "rewa-solar-power-plant-capacity-expansion-begins",
      subtitle: "मध्य प्रदेश की हरित ऊर्जा क्षमता में 250 मेगावाट का होगा इजाफा",
      excerpt: "एशिया के प्रमुख सौर ऊर्जा केंद्रों में शामिल रीवा अल्ट्रा मेगा सोलर प्लांट के नए चरण का निर्माण तेज हो गया है।",
      categorySlug: "rewa",
      isFeatured: false,
      isBreaking: false,
      views: 4120,
      aiAssisted: false,
      aiSummary: null,
      tags: ["madhya-pradesh", "vikas"],
    },
    {
      title: "सागर विश्वविद्यालय में राष्ट्रीय विज्ञान संगोष्ठी का आयोजन, युवा शोधकर्ताओं ने पेश किए मॉडल",
      slug: "sagar-university-national-science-symposium-young-researchers",
      subtitle: "जल संरक्षण और कृषि तकनीक पर आधारित नवाचारों को मिला सम्मान",
      excerpt: "डॉ. हरिसिंह गौर केंद्रीय विश्वविद्यालय सागर में दो दिवसीय राष्ट्रीय विज्ञान सम्मेलन में देशभर से वैज्ञानिक शामिल हुए।",
      categorySlug: "sagar",
      isFeatured: false,
      isBreaking: false,
      views: 3150,
      aiAssisted: false,
      aiSummary: null,
      tags: ["madhya-pradesh", "education"],
    },
    {
      title: "रतलाम में रेलवे जंक्शन के आधुनिकीकरण का पहला चरण पूरा, यात्रियों को मिलेंगी एयरपोर्ट जैसी सुविधाएं",
      slug: "ratlam-railway-junction-modernization-first-phase-complete",
      subtitle: "नए फुट ओवरब्रिज और डिजिटल डिस्प्ले बोर्ड का किया गया लोकार्पण",
      excerpt: "अमृत भारत स्टेशन योजना के तहत रतलाम रेलवे स्टेशन पर यात्री सुविधाओं का तेजी से विस्तार किया जा रहा है।",
      categorySlug: "ratlam",
      isFeatured: false,
      isBreaking: false,
      views: 2980,
      aiAssisted: false,
      aiSummary: null,
      tags: ["madhya-pradesh", "vikas"],
    },
    {
      title: "भोपाल में राज्य स्तरीय स्टार्टअप कॉन्क्लेव: 40 से अधिक नए उद्यमों को मिली सीड फंडिंग",
      slug: "bhopal-state-level-startup-conclave-seed-funding",
      subtitle: "एग्रीटेक और हेल्थटेक क्षेत्र के नवाचारों ने निवेशकों को किया आकर्षित",
      excerpt: "भोपाल के कुशाभाऊ ठाकरे सभागार में आयोजित स्टार्टअप समिट में प्रदेश के युवा उद्यमियों ने अपने उत्पाद प्रदर्शित किए।",
      categorySlug: "bhopal",
      isFeatured: false,
      isBreaking: false,
      views: 4510,
      aiAssisted: true,
      aiSummary: "• भोपाल स्टार्टअप कॉन्क्लेव में 40 से अधिक स्टार्टअप्स को सीड फंडिंग मिली।\n• एग्रीटेक, एडटेक और हेल्थटेक क्षेत्रों में सबसे ज्यादा निवेश प्रस्ताव आए।\n• राज्य सरकार ने टियर-2 शहरों में नए इनक्यूबेशन सेंटर खोलने की घोषणा की।",
      tags: ["bhopal", "technology", "economy"],
    },
    {
      title: "इंदौर आईआईएम और आईआईटी मिलकर करेंगे स्मार्ट ट्रैफिक मैनेजमेंट पर शोध",
      slug: "indore-iim-and-iit-joint-research-smart-traffic-management",
      subtitle: "शहर के प्रमुख चौराहों पर जाम से निजात दिलाने के लिए बनेगा नया एल्गोरिदम",
      excerpt: "इंदौर में बढ़ते यातायात दबाव को कम करने के लिए दोनों प्रमुख संस्थानों ने नगर पुलिस के साथ एमओयू साइन किया है।",
      categorySlug: "indore",
      isFeatured: false,
      isBreaking: false,
      views: 5230,
      aiAssisted: false,
      aiSummary: null,
      tags: ["indore", "technology", "education"],
    },
    {
      title: "देश में डिजिटल भुगतान ने तोड़ा रिकॉर्ड, यूपीआई ट्रांजेक्शन में ग्रामीण क्षेत्रों की हिस्सेदारी बढ़ी",
      slug: "india-digital-payments-upi-record-rural-adoption",
      subtitle: "आरबीआई की ताजा रिपोर्ट में छोटे शहरों की तेज भागीदारी के आंकड़े आए सामने",
      excerpt: "भारत में डिजिटल लेनदेन की रफ्तार लगातार नए कीर्तिमान बना रही है, जिसमें यूपीआई की भूमिका सबसे अहम रही है।",
      categorySlug: "india",
      isFeatured: false,
      isBreaking: true,
      views: 11200,
      aiAssisted: true,
      aiSummary: "• यूपीआई लेनदेन में पिछले वर्ष की तुलना में 38% की वृद्धि दर्ज की गई।\n• टियर-3 और ग्रामीण क्षेत्रों में क्यूआर कोड आधारित भुगतान तेजी से बढ़ा है।\n• आरबीआई ने ऑफलाइन डिजिटल पेमेंट की सीमा बढ़ाने के संकेत दिए हैं।",
      tags: ["economy", "technology"],
    },
    {
      title: "नई शिक्षा नीति के तहत विश्वविद्यालयों में स्किल-बेस्ड कोर्स होंगे अनिवार्य, यूजीसी ने जारी किए निर्देश",
      slug: "ugc-guidelines-skill-based-courses-mandatory-under-nep",
      subtitle: "स्नातक स्तर पर इंटर्नशिप और प्रैक्टिकल ट्रेनिंग को मिलेगा प्राथमिकता अंक",
      excerpt: "विश्वविद्यालय अनुदान आयोग ने सभी उच्च शिक्षण संस्थानों को आगामी सत्र से रोजगारपरक पाठ्यक्रम शामिल करने को कहा है।",
      categorySlug: "india",
      isFeatured: false,
      isBreaking: false,
      views: 7450,
      aiAssisted: false,
      aiSummary: null,
      tags: ["education"],
    },
    {
      title: "वैश्विक जलवायु शिखर सम्मेलन में स्वच्छ ऊर्जा निवेश पर बनी सहमति, विकासशील देशों को मिलेगा फंड",
      slug: "global-climate-summit-clean-energy-investment-agreement",
      subtitle: "सौर और पवन ऊर्जा परियोजनाओं के लिए 2030 तक तय किए गए नए लक्ष्य",
      excerpt: "अंतरराष्ट्रीय जलवायु सम्मेलन में सदस्य देशों ने कार्बन उत्सर्जन घटाने और हरित तकनीक साझा करने का संकल्प दोहराया।",
      categorySlug: "world",
      isFeatured: false,
      isBreaking: false,
      views: 3890,
      aiAssisted: false,
      aiSummary: null,
      tags: ["economy"],
    },
    {
      title: "टीम इंडिया ने रोमांचक मुकाबले में दर्ज की शानदार जीत, युवा बल्लेबाजों के शतक ने बदला मैच का रुख",
      slug: "team-india-thrilling-victory-young-batters-shine",
      subtitle: "गेंदबाजों ने अंतिम ओवरों में कसी लगाम, सीरीज में बनाई अजेय बढ़त",
      excerpt: "भारतीय क्रिकेट टीम ने शानदार हरफनमौला प्रदर्शन करते हुए मेहमान टीम को 4 विकेट से मात दी।",
      categorySlug: "sports",
      isFeatured: false,
      isBreaking: true,
      views: 15600,
      aiAssisted: false,
      aiSummary: null,
      tags: ["cricket"],
    },
    {
      title: "मध्य प्रदेश की अंडर-19 क्रिकेट टीम ने राष्ट्रीय टूर्नामेंट के फाइनल में बनाई जगह",
      slug: "mp-under-19-cricket-team-reaches-national-final",
      subtitle: "इंदौर और ग्वालियर के खिलाड़ियों ने सेमीफाइनल में दिखाया बेहतरीन खेल",
      excerpt: "कूच बिहार ट्रॉफी के सेमीफाइनल मुकाबले में मध्य प्रदेश के खिलाड़ियों ने शानदार गेंदबाजी से जीत हासिल की।",
      categorySlug: "sports",
      isFeatured: false,
      isBreaking: false,
      views: 4980,
      aiAssisted: false,
      aiSummary: null,
      tags: ["cricket", "madhya-pradesh"],
    },
    {
      title: "शेयर बाजार में मजबूती का रुख: बैंकिंग और ऑटो सेक्टर के शेयरों में जोरदार खरीदारी",
      slug: "stock-market-rally-banking-and-auto-stocks-gain",
      subtitle: "निवेशकों के भरोसे से सेंसेक्स और निफ्टी नए शिखर के करीब पहुंचे",
      excerpt: "घरेलू संस्थागत निवेशकों की मजबूत खरीदारी के चलते भारतीय शेयर बाजार में आज सकारात्मक कारोबार देखने को मिला।",
      categorySlug: "business",
      isFeatured: false,
      isBreaking: false,
      views: 6120,
      aiAssisted: false,
      aiSummary: null,
      tags: ["economy"],
    },
    {
      title: "एमएसएमई सेक्टर के लिए सस्ते कर्ज की नई योजना, छोटे उद्योगों को मिलेगा बिना गारंटी लोन",
      slug: "new-msme-credit-scheme-collateral-free-loans",
      subtitle: "केंद्र सरकार ने क्रेडिट गारंटी सीमा बढ़ाने का किया ऐलान",
      excerpt: "लघु एवं मध्यम उद्योगों को विस्तार देने के लिए बैंकों को त्वरित ऋण स्वीकृति प्रक्रिया अपनाने के निर्देश दिए गए हैं।",
      categorySlug: "business",
      isFeatured: false,
      isBreaking: false,
      views: 4320,
      aiAssisted: false,
      aiSummary: null,
      tags: ["economy"],
    },
    {
      title: "मध्य प्रदेश में फिल्म शूटिंग को बढ़ावा: महेश्वर और ओरछा बने बॉलीवुड निर्देशकों की पहली पसंद",
      slug: "film-shooting-boom-in-mp-maheshwar-orchha-top-choices",
      subtitle: "राज्य की फिल्म पर्यटन नीति से स्थानीय कलाकारों और पर्यटन को मिल रहा लाभ",
      excerpt: "ऐतिहासिक धरोहरों और सिंगल-विंडो क्लीयरेंस की वजह से इस साल प्रदेश में दो दर्जन से अधिक फिल्मों की शूटिंग तय है।",
      categorySlug: "entertainment",
      isFeatured: false,
      isBreaking: false,
      views: 5410,
      aiAssisted: false,
      aiSummary: null,
      tags: ["madhya-pradesh"],
    },
    {
      title: "भारतीय भाषाओं के लिए नया एआई वॉयस असिस्टेंट लॉन्च, हिंदी समेत 12 भाषाओं में करेगा काम",
      slug: "new-ai-voice-assistant-launched-for-indian-languages",
      subtitle: "सरकारी सेवाओं और बैंकिंग जानकारी को आम नागरिकों तक पहुंचाना होगा आसान",
      excerpt: "स्वदेशी टेक स्टार्टअप द्वारा विकसित यह एआई प्लेटफॉर्म ग्रामीण और शहरी उपयोगकर्ताओं को आवाज के जरिए डिजिटल सेवाएं देगा।",
      categorySlug: "technology",
      isFeatured: false,
      isBreaking: false,
      views: 8740,
      aiAssisted: true,
      aiSummary: "• नया भारतीय एआई वॉयस असिस्टेंट हिंदी सहित 12 क्षेत्रीय भाषाओं को सपोर्ट करता है।\n• यह कम इंटरनेट स्पीड वाले क्षेत्रों में भी सुचारू रूप से काम करने में सक्षम है।\n• इसका उपयोग कृषि सलाह, बैंकिंग और नागरिक सेवाओं के लिए किया जाएगा।",
      tags: ["technology"],
    },
    {
      title: "संपादकीय: छोटे शहरों में डिजिटल पत्रकारिता की बढ़ती विश्वसनीयता और हमारी जिम्मेदारी",
      slug: "editorial-rising-credibility-of-digital-journalism-in-tier-2-cities",
      subtitle: "तथ्यों की जांच और स्थानीय मुद्दों की गहराई से रिपोर्टिंग ही असली ताकत",
      excerpt: "तेजी से बदलते डिजिटल दौर में पाठकों का भरोसा बनाए रखने के लिए सटीक और निष्पक्ष पत्रकारिता पहले से कहीं अधिक आवश्यक है।",
      categorySlug: "opinion",
      isFeatured: false,
      isBreaking: false,
      views: 2760,
      aiAssisted: false,
      aiSummary: null,
      tags: ["education"],
    },
  ];

  for (let i = 0; i < sampleArticles.length; i++) {
    const a = sampleArticles[i];
    const categoryId = catMap.get(a.categorySlug) ?? mpId;
    const publishedAt = new Date(now - i * 3 * 3600 * 1000);
    const bodyHtml = `<p><strong>भोपाल/डेस्क:</strong> ${a.excerpt}</p>
<p>स्थानीय प्रशासन और संबंधित विभागों के अधिकारियों ने बताया कि इस पहल से आम नागरिकों को सीधा लाभ मिलेगा। परियोजना के क्रियान्वयन के लिए समयबद्ध कार्ययोजना तैयार की गई है और नियमित समीक्षा की जा रही है।</p>
<h2>प्रमुख बिंदु और आगामी योजना</h2>
<p>विशेषज्ञों का मानना है कि बुनियादी ढांचे और डिजिटल सेवाओं में हो रहे इस सुधार से क्षेत्रीय विकास को नई गति मिलेगी। आने वाले महीनों में इसके सकारात्मक परिणाम जमीनी स्तर पर दिखाई देने लगेंगे।</p>
<blockquote>"हमारा लक्ष्य पारदर्शी व्यवस्था और बेहतर नागरिक सुविधाएं समय पर उपलब्ध कराना है।" — वरिष्ठ अधिकारी</blockquote>
<p>फिलहाल संबंधित एजेंसियां अगले चरण की तैयारियों में जुटी हुई हैं और आम जनता से भी सुझाव आमंत्रित किए गए हैं।</p>`;

    const article = await prisma.article.upsert({
      where: { slug: a.slug },
      update: {},
      create: {
        title: a.title,
        slug: a.slug,
        subtitle: a.subtitle,
        excerpt: a.excerpt,
        content: bodyHtml,
        featuredImage: `https://picsum.photos/seed/${a.slug.slice(0, 16)}/1200/675`,
        imageCaption: a.subtitle,
        imageAlt: a.title,
        status: "PUBLISHED",
        isBreaking: a.isBreaking,
        isFeatured: a.isFeatured,
        hideAds: false,
        views: a.views,
        authorName: "धमाका 24*7 संवाददाता",
        categoryId,
        metaTitle: a.title.slice(0, 60),
        metaDescription: a.excerpt.slice(0, 155),
        aiSummary: a.aiSummary,
        aiAssisted: a.aiAssisted,
        publishedAt,
      },
    });

    for (const tagSlug of a.tags) {
      const tagId = tagMap.get(tagSlug);
      if (tagId) {
        await prisma.articleTag.upsert({
          where: { articleId_tagId: { articleId: article.id, tagId } },
          update: {},
          create: { articleId: article.id, tagId },
        });
      }
    }
  }

  // 5. Ad Placements & Demo Ads
  const placements = [
    { key: "header-leaderboard", name: "Header Leaderboard (728x90)", type: "CUSTOM" },
    { key: "sidebar-top", name: "Sidebar Top (300x250)", type: "CUSTOM" },
    { key: "sidebar-sticky", name: "Sidebar Sticky (300x600)", type: "CUSTOM" },
    { key: "in-article-2", name: "In-Article After Paragraph 2", type: "CUSTOM" },
    { key: "in-article-5", name: "In-Article After Paragraph 5", type: "CUSTOM" },
    { key: "list-between", name: "Between Article Lists (Every 5th)", type: "CUSTOM" },
    { key: "footer-mobile", name: "Footer Sticky Mobile (320x50)", type: "CUSTOM" },
  ];

  const placementMap = new Map<string, string>();
  for (const p of placements) {
    const rec = await prisma.adPlacement.upsert({
      where: { key: p.key },
      update: { name: p.name },
      create: p,
    });
    placementMap.set(p.key, rec.id);
  }

  const existingAds = await prisma.ad.count();
  if (existingAds === 0) {
    const headerAd = await prisma.ad.create({
      data: {
        placementId: placementMap.get("header-leaderboard")!,
        title: "MP Tourism — Heart of Incredible India",
        imageUrl: "https://placehold.co/728x90/b91c1c/ffffff?text=MP+Tourism+-+Explore+Madhya+Pradesh",
        targetUrl: "https://www.mptourism.com",
        cpm: 45,
        cpc: 3.5,
        isActive: true,
      },
    });

    const sidebarAd = await prisma.ad.create({
      data: {
        placementId: placementMap.get("sidebar-top")!,
        title: "Digital News Subscription Offer",
        imageUrl: "https://placehold.co/300x250/1e293b/ffffff?text=Special+Offer+-+300x250",
        targetUrl: "https://example.com/offer",
        cpm: 60,
        cpc: 4.0,
        isActive: true,
      },
    });

    await prisma.ad.create({
      data: {
        placementId: placementMap.get("in-article-2")!,
        title: "Local Business Directory — Indore & Bhopal",
        imageUrl: "https://placehold.co/640x120/0f766e/ffffff?text=In-Article+Sponsored+Banner",
        targetUrl: "https://example.com/business",
        cpm: 55,
        cpc: 5.0,
        isActive: true,
      },
    });

    // Seed 7 days of sample AdStat & RevenueEntry
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - d);

      await prisma.adStat.create({
        data: {
          adId: headerAd.id,
          placementId: placementMap.get("header-leaderboard")!,
          date,
          impressions: 3200 + d * 210,
          clicks: 38 + d * 4,
        },
      });
      await prisma.adStat.create({
        data: {
          adId: sidebarAd.id,
          placementId: placementMap.get("sidebar-top")!,
          date,
          impressions: 2400 + d * 150,
          clicks: 31 + d * 3,
        },
      });
      await prisma.revenueEntry.create({
        data: {
          date,
          source: "ADSENSE",
          amount: Number((420 + d * 35.5).toFixed(2)),
          note: "Daily AdSense earnings",
        },
      });
    }
  }

  // 6. Default Settings
  const defaultSettings = [
    { key: "siteName", value: "धमाका 24*7" },
    { key: "siteTagline", value: "मध्य प्रदेश, देश और दुनिया की ताजा खबरें" },
    { key: "adsEnabled", value: "true" },
    { key: "aiEnabled", value: "true" },
    { key: "aiDailyLimit", value: process.env.AI_DAILY_LIMIT || "200" },
    { key: "adsenseClientId", value: process.env.ADSENSE_CLIENT_ID || "" },
    {
      key: "adsTxt",
      value: `# ads.txt - authorized digital sellers\n# google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n`,
    },
  ];
  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // 7. Sample Ticker Items
  const tickerCount = await prisma.tickerItem.count();
  if (tickerCount === 0) {
    await prisma.tickerItem.createMany({
      data: [
        {
          text: "भोपाल मेट्रो के दूसरे चरण का ट्रायल रन सफल, जल्द खुलेगा नया कॉरिडोर",
          url: "/news/bhopal-metro-second-phase-trial-run-successful",
          isActive: true,
          order: 1,
        },
        {
          text: "देश में यूपीआई डिजिटल भुगतान ने तोड़ा रिकॉर्ड, ग्रामीण क्षेत्रों की हिस्सेदारी बढ़ी",
          url: "/news/india-digital-payments-upi-record-rural-adoption",
          isActive: true,
          order: 2,
        },
        {
          text: "टीम इंडिया ने रोमांचक मुकाबले में दर्ज की शानदार जीत, सीरीज में बनाई बढ़त",
          url: "/news/team-india-thrilling-victory-young-batters-shine",
          isActive: true,
          order: 3,
        },
      ],
    });
  }

  console.log("Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
