import React, { createContext, useContext, useState, useEffect } from "react";

export type SupportedLanguage = "en" | "hi" | "mr" | "ta" | "te" | "gu" | "bn";

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳" },
];

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Header
    portalTitle: "AICTE FIXED DEPOSIT REGULATORY BUREAU",
    portalSubtitle: "Receipts · due dates · decisions",
    appTitle: "FDR Shield",
    appSubtitle: "AICTE Fixed deposit monitoring & verification",
    searchPlaceholder: "Search institution, FDR, bank…",
    officialAccess: "Official access",
    signInRequired: "Sign in required",
    signOut: "Sign out",
    signIn: "Sign in",
    portfolioDate: "PORTFOLIO DATE",
    asAt: "AS AT",

    // Navigation
    overview: "Overview",
    fdrRegister: "FDR register",
    verificationQueue: "Verification queue",
    institutions: "Institutions",
    alertsEscalation: "Alerts & escalation",
    reports: "Reports",
    administration: "Administration",

    // Hero / Page Headings
    portfolioPosition: "PORTFOLIO POSITION",
    fdrRiskMonitoring: "FDR risk monitoring",
    fdrRiskDesc: "Deposits on record, ranked by maturity date and verification risk.",
    submitFdr: "Submit FDR",
    exportCsv: "Export CSV",

    // Stat Measures
    principalOnFile: "PRINCIPAL ON FILE",
    receiptsCount: "receipts across",
    institutionsCount: "institutions",
    maturing30Days: "MATURING · 30 DAYS",
    upcomingMaturities: "Upcoming maturities",
    needsVerification: "NEEDS VERIFICATION",
    missingReceiptOrFlag: "Missing receipt or field flag",
    overdue: "OVERDUE",
    noOverdue: "No overdue requests",
    reviewWithoutDelay: "Review without delay",

    // Priority Watchlist
    openRegisterRef: "01 / OPEN REGISTER",
    resolveTheseFirst: "Resolve these first",
    openRequestsOrdered: "open requests · ordered by maturity and verification risk",
    fullRegister: "Full register",
    openAllRecords: "Open all FDR records",
    noRecordsAttention: "No records need attention",
    newReceiptsNotice: "New receipts and approaching maturities will appear in this register.",

    // Table Headers
    thInstitutionFdr: "INSTITUTION / FDR",
    thBank: "BANK",
    thPrincipalAmount: "PRINCIPAL AMOUNT",
    thMaturity: "MATURITY",
    thStatus: "STATUS",

    // Status & Badges
    approved: "Approved",
    underReview: "Under Review",
    rejected: "Rejected",
    pending: "Pending",
    flag: "flag",
    flags: "flags",
    daysRemaining: "d remaining",
    overdueBy: "Overdue by",
    maturesToday: "Matures today",

    // Lower Modules
    maturityCalendarRef: "02 / MATURITY CALENDAR",
    dueNext30Days: "Due in the next 30 days",
    allAlerts: "All alerts",
    institutionalExposureRef: "03 / INSTITUTIONS",
    institutionalExposure: "Institutional exposure",
    allInstitutions: "All institutions",
  },
  hi: {
    // Header
    portalTitle: "अखिल भारतीय तकनीकी शिक्षा परिषद - सावधि जमा विनियामक ब्यूरो",
    portalSubtitle: "रसीदें · देय तिथियां · विनियामक निर्णय",
    appTitle: "एफडीआर शील्ड",
    appSubtitle: "एआईसीटीई सावधि जमा निगरानी एवं सत्यापन",
    searchPlaceholder: "संस्थान, एफडीआर संख्या, बैंक खोजें…",
    officialAccess: "अधिकारिक प्रवेश",
    signInRequired: "लॉग इन आवश्यक",
    signOut: "साइन आउट",
    signIn: "साइन इन",
    portfolioDate: "पोर्टफोलियो दिनांक",
    asAt: "दिनांक अनुसार",

    // Navigation
    overview: "अवलोकन (डैशबोर्ड)",
    fdrRegister: "एफडीआर रजिस्टर",
    verificationQueue: "सत्यापन कतार",
    institutions: "संबद्ध संस्थान",
    alertsEscalation: "अलर्ट एवं एस्केलेशन",
    reports: "रिपोर्ट्स",
    administration: "प्रशासन",

    // Hero / Page Headings
    portfolioPosition: "पोर्टफोलियो स्थिति",
    fdrRiskMonitoring: "एफडीआर जोखिम निगरानी",
    fdrRiskDesc: "अभिलेख में दर्ज सावधि जमा, परिपक्वता तिथि एवं सत्यापन जोखिम के अनुसार क्रमबद्ध।",
    submitFdr: "नया एफडीआर जमा करें",
    exportCsv: "सीएसवी निर्यात",

    // Stat Measures
    principalOnFile: "कुल सुरक्षित जमा राशि",
    receiptsCount: "रसीदें कुल",
    institutionsCount: "संस्थानों में",
    maturing30Days: "30 दिनों में परिपक्व",
    upcomingMaturities: "आगामी परिपक्वताएं",
    needsVerification: "सत्यापन आवश्यक",
    missingReceiptOrFlag: "रसीद अनुपलब्ध अथवा विसंगति ध्वजांकित",
    overdue: "अतिदेय (ओवरड्यू)",
    noOverdue: "कोई अतिदेय अनुरोध नहीं",
    reviewWithoutDelay: "अविलंब समीक्षा आवश्यक",

    // Priority Watchlist
    openRegisterRef: "01 / खुला रजिस्टर",
    resolveTheseFirst: "इन्हें प्राथमिकता से निपटाएं",
    openRequestsOrdered: "खुले अनुरोध · परिपक्वता एवं जोखिम के आधार पर क्रमबद्ध",
    fullRegister: "पूर्ण रजिस्टर",
    openAllRecords: "सभी एफडीआर अभिलेख खोलें",
    noRecordsAttention: "किसी अभिलेख पर ध्यान देने की आवश्यकता नहीं",
    newReceiptsNotice: "नई रसीदें एवं आगामी परिपक्वताएं यहां प्रदर्शित होंगी।",

    // Table Headers
    thInstitutionFdr: "संस्थान / एफडीआर संख्या",
    thBank: "जारीकर्ता बैंक",
    thPrincipalAmount: "जमा मूलधन राशि",
    thMaturity: "परिपक्वता तिथि",
    thStatus: "सत्यापन स्थिति",

    // Status & Badges
    approved: "स्वीकृत (मान्य)",
    underReview: "समीक्षाधीन",
    rejected: "अस्वीकृत",
    pending: "लंबित",
    flag: "विसंगति",
    flags: "विसंगतियाँ",
    daysRemaining: "दिन शेष",
    overdueBy: "दिन अतिदेय",
    maturesToday: "आज परिपक्व",

    // Lower Modules
    maturityCalendarRef: "02 / परिपक्वता कैलेंडर",
    dueNext30Days: "अगले 30 दिनों में देय",
    allAlerts: "सभी अलर्ट देखें",
    institutionalExposureRef: "03 / संबद्ध संस्थान",
    institutionalExposure: "संस्थानवार कुल जमा स्थिति",
    allInstitutions: "सभी संस्थान देखें",
  },
  mr: {
    portalTitle: "अखिल भारतीय तंत्रशिक्षण परिषद - मुदत ठेव नियामक कक्ष",
    portalSubtitle: "पावत्या · देय तारखा · नियामक निर्णय",
    appTitle: "एफडीआर शील्ड",
    appSubtitle: "एआयसीटीई मुदत ठेव देखरेख व पडताळणी",
    searchPlaceholder: "संस्था, एफडीआर क्रमांक, बँक शोधा…",
    officialAccess: "अधिकृत प्रवेश",
    signInRequired: "लॉगिन आवश्यक",
    signOut: "साइन आउट",
    signIn: "साइन इन",
    portfolioDate: "पोर्टफोलिओ तारीख",
    asAt: "तारीख",

    overview: "आढावा (डॅशबोर्ड)",
    fdrRegister: "एफडीआर नोंदवही",
    verificationQueue: "पडताळणी रांग",
    institutions: "संस्था",
    alertsEscalation: "सूचना व पाठपुरावा",
    reports: "अहवाल",
    administration: "प्रशासन",

    portfolioPosition: "पोर्टफोलिओ स्थिती",
    fdrRiskMonitoring: "मुदत ठेव जोखीम देखरेख",
    fdrRiskDesc: "नोंदवहीतील ठेवी, मुदत समाप्ती तारीख व पडताळणी जोखमीनुसार क्रमवारी.",
    submitFdr: "नवीन एफडीआर सादर करा",
    exportCsv: "सीएसव्ही निर्यात",

    principalOnFile: "एकूण सुरक्षित ठेव रक्कम",
    receiptsCount: "पावत्या एकूण",
    institutionsCount: "संस्थांमध्ये",
    maturing30Days: "३० दिवसांत मुदत संपणारे",
    upcomingMaturities: "आगामी मुदत समाप्ती",
    needsVerification: "पडताळणी आवश्यक",
    missingReceiptOrFlag: "पावती गहाळ किंवा विसंगती",
    overdue: "थकबाकी (मुदत संपलेली)",
    noOverdue: "कोणतीही थकबाकी नाही",
    reviewWithoutDelay: "तातडीने पुनरावलोकन करा",

    openRegisterRef: "०१ / खुली नोंदवही",
    resolveTheseFirst: "प्राधान्याने निकाली काढा",
    openRequestsOrdered: "खुले विनंती अर्ज · मुदत आणि जोखमीनुसार क्रमवारी",
    fullRegister: "संपूर्ण नोंदवही",
    openAllRecords: "सर्व एफडीआर नोंदी पहा",
    noRecordsAttention: "कोणत्याही नोंदीवर तातडीचे काम नाही",
    newReceiptsNotice: "नवीन पावत्या आणि आगामी मुदत येथे दिसतील.",

    thInstitutionFdr: "संस्था / एफडीआर क्रमांक",
    thBank: "बँक",
    thPrincipalAmount: "ठेव रक्कम",
    thMaturity: "मुदत समाप्ती",
    thStatus: "स्थिती",

    approved: "मंजूर",
    underReview: "पुनरावलोकन चालू",
    rejected: "नाकारले",
    pending: "प्रलंबित",
    flag: "विसंगती",
    flags: "विसंगती",
    daysRemaining: "दिवस शिल्लक",
    overdueBy: "दिवस थकीत",
    maturesToday: "आज मुदत संपते",

    maturityCalendarRef: "०२ / मुदत दिनदर्शिका",
    dueNext30Days: "पुढील ३० दिवसांत देय",
    allAlerts: "सर्व सूचना पहा",
    institutionalExposureRef: "०३ / संस्था",
    institutionalExposure: "संस्थानिहाय ठेव",
    allInstitutions: "सर्व संस्था पहा",
  },
  ta: {
    portalTitle: "அகில இந்திய தொழில்நுட்பக் கல்வி கவுன்சில் - நிலையான வைப்பு ஒழுங்குமுறை பிரிவு",
    portalSubtitle: "ரசீதுகள் · முதிர்வு தேதிகள் · முடிவுகள்",
    appTitle: "FDR ஷீல்ட்",
    appSubtitle: "AICTE நிலையான வைப்புத்தொகை கண்காணிப்பு & சரிபார்ப்பு",
    searchPlaceholder: "கல்வி நிறுவனம், FDR எண், வங்கி தேடுங்கள்…",
    officialAccess: "அதிகாரப்பூர்வ அணுகல்",
    signInRequired: "உள்நுழைவு தேவை",
    signOut: "வெளியேறு",
    signIn: "உள்நுழைக",
    portfolioDate: "போர்ட்ஃபோலியோ தேதி",
    asAt: "தேதி நிலவரப்படி",

    overview: "கண்ணோட்டம்",
    fdrRegister: "FDR பதிவேடு",
    verificationQueue: "சரிபார்ப்பு வரிசை",
    institutions: "நிறுவனங்கள்",
    alertsEscalation: "எச்சரிக்கைகள் & நடவடிக்கைகள்",
    reports: "அறிக்கைகள்",
    administration: "நிர்வாகம்",

    portfolioPosition: "போர்ட்ஃபோலியோ நிலை",
    fdrRiskMonitoring: "FDR அபாய கண்காணிப்பு",
    fdrRiskDesc: "பதிவில் உள்ள வைப்புத்தொகைகள், முதிர்வு தேதி மற்றும் சரிபார்ப்பு அபாயத்தின்படி வரிசைப்படுத்தப்பட்டுள்ளன.",
    submitFdr: "புதிய FDR சமர்ப்பிக்கவும்",
    exportCsv: "CSV பதிவிறக்குக",

    principalOnFile: "மொத்த பாதுகாப்பு வைப்புத்தொகை",
    receiptsCount: "ரசீதுகள்",
    institutionsCount: "நிறுவனங்களில்",
    maturing30Days: "30 நாட்களில் முதிர்வடைபவை",
    upcomingMaturities: "வரவிருக்கும் முதிர்வுகள்",
    needsVerification: "சரிபார்ப்பு தேவை",
    missingReceiptOrFlag: "ரசீது விடுபட்டது அல்லது முரண்பாடு",
    overdue: "காலாவதியானது (ஓவர்டியூ)",
    noOverdue: "காலாவதியான கோரிக்கைகள் இல்லை",
    reviewWithoutDelay: "உடனடியாக மதிப்பாய்வு செய்க",

    openRegisterRef: "01 / திறந்த பதிவேடு",
    resolveTheseFirst: "இவற்றை முதலில் தீர்க்கவும்",
    openRequestsOrdered: "திறந்த கோரிக்கைகள் · முதிர்வு மற்றும் அபாயத்தின் அடிப்படையில்",
    fullRegister: "முழு பதிவேடு",
    openAllRecords: "அனைத்து FDRகளையும் காண்க",
    noRecordsAttention: "கவனம் செலுத்த வேண்டிய பதிவுகள் இல்லை",
    newReceiptsNotice: "புதிய ரசீதுகள் மற்றும் முதிர்வுகள் இங்கு தோன்றும்.",

    thInstitutionFdr: "நிறுவனம் / FDR எண்",
    thBank: "வங்கி",
    thPrincipalAmount: "வைப்புத்தொகை",
    thMaturity: "முதிர்வு தேதி",
    thStatus: "நிலை",

    approved: "ஒப்புதல் அளிக்கப்பட்டது",
    underReview: "மதிப்பாய்வில் உள்ளது",
    rejected: "நிராகரிக்கப்பட்டது",
    pending: "நிலுவையில் உள்ளது",
    flag: "முரண்பாடு",
    flags: "முரண்பாடுகள்",
    daysRemaining: "நாட்கள் மீதம்",
    overdueBy: "நாட்கள் தாமதம்",
    maturesToday: "இன்று முதிர்வடைகிறது",

    maturityCalendarRef: "02 / முதிர்வு நாட்காட்டி",
    dueNext30Days: "அடுத்த 30 நாட்களில் முதிர்வடைபவை",
    allAlerts: "அனைத்து எச்சரிக்கைகளும்",
    institutionalExposureRef: "03 / நிறுவனங்கள்",
    institutionalExposure: "நிறுவன அளவிலான வைப்புத்தொகை",
    allInstitutions: "அனைத்து நிறுவனங்களும்",
  },
  te: {
    portalTitle: "అఖిల భారత సాంకేతిక విద్యా మండలి - స్థిర డిపాజిట్ నియంత్రణ విభాగం",
    portalSubtitle: "రసీదులు · గడువు తేదీలు · నిర్ణయాలు",
    appTitle: "FDR షీల్డ్",
    appSubtitle: "AICTE స్థిర డిపాజిట్ పర్యవేక్షణ & ధృవీకరణ",
    searchPlaceholder: "సంస్థ, FDR నంబర్, బ్యాంక్ వెతకండి…",
    officialAccess: "అధికారిక ప్రాప్యత",
    signInRequired: "లాగిన్ అవసరం",
    signOut: "సైన్ అవుట్",
    signIn: "సైన్ ఇన్",
    portfolioDate: "పోర్ట్‌ఫోలియో తేదీ",
    asAt: "తేదీ నాటికి",

    overview: "సమీక్ష (డ్యాష్‌బోర్డ్)",
    fdrRegister: "FDR రిజిస్టర్",
    verificationQueue: "ధృవీకరణ క్యూ",
    institutions: "సంస్థలు",
    alertsEscalation: "హెచ్చరికలు & చర్యలు",
    reports: "నివేదికలు",
    administration: "పరిపాలన",

    portfolioPosition: "పోర్ట్‌ఫోలియో స్థితి",
    fdrRiskMonitoring: "FDR రిస్క్ పర్యవేక్షణ",
    fdrRiskDesc: "డిపాజిట్లు గడువు తేదీ మరియు ధృవీకరణ రిస్క్ ప్రకారం క్రమబద్ధీకరించబడ్డాయి.",
    submitFdr: "కొత్త FDR సమర్పించండి",
    exportCsv: "CSV డౌన్‌లోడ్",

    principalOnFile: "మొత్తం భద్రతా డిపాజిట్",
    receiptsCount: "రసీదులు",
    institutionsCount: "సంస్థలలో",
    maturing30Days: "30 రోజుల్లో గడువు ముగిసేవి",
    upcomingMaturities: "రాబోయే గడువులు",
    needsVerification: "ధృవీకరణ అవసరం",
    missingReceiptOrFlag: "రసీదు లేదు లేదా వ్యత్యాసం ఉంది",
    overdue: "గడువు ముగిసింది",
    noOverdue: "గడువు ముగిసిన అభ్యర్థనలు లేవు",
    reviewWithoutDelay: "వెంటనే సమీక్షించండి",

    openRegisterRef: "01 / ఓపెన్ రిజిస్టర్",
    resolveTheseFirst: "ముందుగా వీటిని పరిష్కరించండి",
    openRequestsOrdered: "పెండింగ్ అభ్యర్థనలు · గడువు మరియు రిస్క్ ఆధారంగా",
    fullRegister: "పూర్తి రిజిస్టర్",
    openAllRecords: "అన్ని FDR రికార్డులను తెరవండి",
    noRecordsAttention: "శ్రద్ధ అవసరమైన రికార్డులు లేవు",
    newReceiptsNotice: "కొత్త రసీదులు ఇక్కడ కనిపిస్తాయి.",

    thInstitutionFdr: "సంస్థ / FDR నంబర్",
    thBank: "బ్యాంక్",
    thPrincipalAmount: "డిపాజిట్ మొత్తం",
    thMaturity: "గడువు తేదీ",
    thStatus: "స్థితి",

    approved: "ఆమోదించబడింది",
    underReview: "సమీక్షలో ఉంది",
    rejected: "తిరస్కరించబడింది",
    pending: "పెండింగ్‌లో ఉంది",
    flag: "తేడా",
    flags: "తేడాలు",
    daysRemaining: "రోజులు మిగిలి ఉన్నాయి",
    overdueBy: "రోజులు ఆలస్యం",
    maturesToday: "నేడు గడువు ముగుస్తుంది",

    maturityCalendarRef: "02 / గడువు క్యాలెండర్",
    dueNext30Days: "తదుపరి 30 రోజుల్లో చెల్లించాల్సినవి",
    allAlerts: "అన్ని హెచ్చరికలు",
    institutionalExposureRef: "03 / సంస్థలు",
    institutionalExposure: "సంస్థల వారీగా డిపాజిట్లు",
    allInstitutions: "అన్ని సంస్థలు",
  },
  gu: {
    portalTitle: "અખિલ ભારતીય ટેકનિકલ શિક્ષણ પરિષદ - નિયમનકારી બ્યુરો",
    portalSubtitle: "રસીદો · નિયત તારીખો · નિર્ણયો",
    appTitle: "FDR શિલ્ડ",
    appSubtitle: "AICTE ફિક્સ્ડ ડિપોઝિટ મોનિટરિંગ અને વેરિફિકેશન",
    searchPlaceholder: "સંસ્થા, FDR નંબર, બેંક શોધો…",
    officialAccess: "સત્તાવાર પ્રવેશ",
    signInRequired: "સાઇન ઇન જરૂરી",
    signOut: "સાઇન આઉટ",
    signIn: "સાઇન ઇન",
    portfolioDate: "પોર્ટફોલિયો તારીખ",
    asAt: "તારીખ મુજબ",

    overview: "ઝાંખી",
    fdrRegister: "FDR રજિસ્ટર",
    verificationQueue: "ચકાસણી કતાર",
    institutions: "સંસ્થાઓ",
    alertsEscalation: "ચેતવણીઓ અને એસ્કેલેશન",
    reports: "અહેવાલો",
    administration: "વહીવટ",

    portfolioPosition: "પોર્ટફોલિયો સ્થિતિ",
    fdrRiskMonitoring: "FDR જોખમ મોનિટરિંગ",
    fdrRiskDesc: "રેકોર્ડ પરની થાપણો, પાકતી તારીખ અને ચકાસણી જોખમ અનુસાર ક્રમાંકિત.",
    submitFdr: "નવી FDR સબમિટ કરો",
    exportCsv: "CSV નિકાસ",

    principalOnFile: "કુલ સુરક્ષિત થાપણ",
    receiptsCount: "રસીદો",
    institutionsCount: "સંસ્થાઓમાં",
    maturing30Days: "30 દિવસમાં પાકતી થાપણ",
    upcomingMaturities: "આગામી પાકતી મુદતો",
    needsVerification: "ચકાસણી જરૂરી",
    missingReceiptOrFlag: "રસીદ ગેરહાજર અથવા વિસંગતતા",
    overdue: "મુદતવીતી (ઓવરડ્યુ)",
    noOverdue: "કોઈ મુદતવીતી વિનંતી નથી",
    reviewWithoutDelay: "વિલંબ કર્યા વિના સમીક્ષા કરો",

    openRegisterRef: "01 / ખુલ્લું રજિસ્ટર",
    resolveTheseFirst: "પહેલા આનો ઉકેલ લાવો",
    openRequestsOrdered: "ખુલ્લી વિનંતીઓ · પાકતી મુદત અને જોખમ અનુસાર",
    fullRegister: "સંપૂર્ણ રજિસ્ટર",
    openAllRecords: "બધા FDR રેકોર્ડ્સ ખોલો",
    noRecordsAttention: "ધ્યાન આપવાની જરૂર હોય તેવા કોઈ રેકોર્ડ નથી",
    newReceiptsNotice: "નવી રસીદો અને આગામી પાકતી મુદતો અહીં દેખાશે.",

    thInstitutionFdr: "સંસ્થા / FDR નંબર",
    thBank: "બેંક",
    thPrincipalAmount: "થાપણ રકમ",
    thMaturity: "પાકતી તારીખ",
    thStatus: "સ્થિતિ",

    approved: "મંજૂર",
    underReview: "સમીક્ષા હેઠળ",
    rejected: "અસ્વીકાર થયેલ",
    pending: "બાકી",
    flag: "વિસંગતતા",
    flags: "વિસંગતતાઓ",
    daysRemaining: "દિવસ બાકી",
    overdueBy: "દિવસ મુદતવીતી",
    maturesToday: "આજે પાકે છે",

    maturityCalendarRef: "02 / પરિપક્વતા કેલેન્ડર",
    dueNext30Days: "આગામી 30 દિવસમાં પાકતી",
    allAlerts: "બધી ચેતવણીઓ",
    institutionalExposureRef: "03 / સંસ્થાઓ",
    institutionalExposure: "સંસ્થાકીય થાપણો",
    allInstitutions: "બધી સંસ્થાઓ",
  },
  bn: {
    portalTitle: "অল ইন্ডিয়া কাউন্সিল ফর টেকনিক্যাল এডুকেশন - ফিক্সড ডিপোজিট রেগুলেটরি ব্যুরো",
    portalSubtitle: "রসিদ · মেয়াদপূর্তির তারিখ · সিদ্ধান্ত",
    appTitle: "FDR শিল্ড",
    appSubtitle: "AICTE ফিক্সড ডিপোজিট পর্যবেক্ষণ ও যাচাইকরণ",
    searchPlaceholder: "প্রতিষ্ঠান, FDR নম্বর, ব্যাংক খুঁজুন…",
    officialAccess: "অফিসিয়াল অ্যাক্সেস",
    signInRequired: "সাইন ইন আবশ্যক",
    signOut: "সাইন আউট",
    signIn: "সাইন ইন",
    portfolioDate: "পোর্টফোলিও তারিখ",
    asAt: "তারিখ অনুযায়ী",

    overview: "সংক্ষিপ্ত বিবরণ",
    fdrRegister: "FDR রেজিস্টার",
    verificationQueue: "যাচাইকরণ সারি",
    institutions: "প্রতিষ্ঠানসমূহ",
    alertsEscalation: "সতর্কতা ও ব্যবস্থা",
    reports: "প্রতিবেদন",
    administration: "প্রশাসন",

    portfolioPosition: "পোর্টফোলিও অবস্থান",
    fdrRiskMonitoring: "FDR ঝুঁকি পর্যবেক্ষণ",
    fdrRiskDesc: "রেকর্ডে থাকা আমানত, মেয়াদপূর্তির তারিখ এবং যাচাইকরণ ঝুঁকি অনুসারে সাজানো।",
    submitFdr: "নতুন FDR জমা দিন",
    exportCsv: "CSV এক্সপোর্ট",

    principalOnFile: "মোট সুরক্ষিত আমানত",
    receiptsCount: "রসিদ",
    institutionsCount: "প্রতিষ্ঠানে",
    maturing30Days: "৩০ দিনে মেয়াদ উত্তীর্ণ",
    upcomingMaturities: "আসন্ন মেয়াদপূর্তি",
    needsVerification: "যাচাইকরণ প্রয়োজন",
    missingReceiptOrFlag: "রসিদ অনুপস্থিত বা অসঙ্গতি",
    overdue: "মেয়াদোত্তীর্ণ (ওভারডিউ)",
    noOverdue: "কোনো মেয়াদোত্তীর্ণ অনুরোধ নেই",
    reviewWithoutDelay: "দেরি না করে পর্যালোচনা করুন",

    openRegisterRef: "০১ / খোলা রেজিস্টার",
    resolveTheseFirst: "প্রথমে এগুলো সমাধান করুন",
    openRequestsOrdered: "খোলা অনুরোধ · মেয়াদ এবং ঝুঁকির ভিত্তিতে সাজানো",
    fullRegister: "সম্পূর্ণ রেজিস্টার",
    openAllRecords: "সমস্ত FDR রেকর্ড দেখুন",
    noRecordsAttention: "মনোযোগ প্রয়োজন এমন কোনো রেকর্ড নেই",
    newReceiptsNotice: "নতুন রসিদ এবং আসন্ন মেয়াদ এখানে দেখা যাবে।",

    thInstitutionFdr: "প্রতিষ্ঠান / FDR নম্বর",
    thBank: "ব্যাংক",
    thPrincipalAmount: "আমানতের পরিমাণ",
    thMaturity: "মেয়াদপূর্তির তারিখ",
    thStatus: "অবস্থা",

    approved: "অনুমোদিত",
    underReview: "পর্যালোচনাধীন",
    rejected: "প্রত্যাখ্যাত",
    pending: "বিচারাধীন",
    flag: "অসঙ্গতি",
    flags: "অসঙ্গতিসমূহ",
    daysRemaining: "দিন বাকি",
    overdueBy: "দিন মেয়াদোত্তীর্ণ",
    maturesToday: "আজ মেয়াদ শেষ",

    maturityCalendarRef: "০২ / মেয়াদপূর্তি ক্যালেন্ডার",
    dueNext30Days: "পরবর্তী ৩০ দিনে প্রদেয়",
    allAlerts: "সমস্ত সতর্কতা",
    institutionalExposureRef: "০৩ / প্রতিষ্ঠান",
    institutionalExposure: "প্রতিষ্ঠানভিত্তিক আমানত",
    allInstitutions: "সমস্ত প্রতিষ্ঠান",
  },
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
  languages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem("fdr_shield_lang");
    return (saved as SupportedLanguage) || "en";
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem("fdr_shield_lang", lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
