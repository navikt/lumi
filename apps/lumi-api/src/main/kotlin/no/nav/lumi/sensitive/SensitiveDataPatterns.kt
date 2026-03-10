package no.nav.lumi.sensitive

/**
 * Sensitive data patterns for Norwegian personal information.
 * These patterns are used to detect and redact PII from feedback text.
 */
object SensitiveDataPatterns {

    /**
     * Norwegian national identity number (fødselsnummer) - 11 digits.
     * Format: DDMMYYXXXXX, optionally with a single space or dash between the
     * 6-digit date part and the 5-digit individual number (e.g. "010203 12345"
     * or "010203-12345").
     */
    val FODSELSNUMMER = Regex("""\b\d{6}[\s-]?\d{5}\b""")

    /**
     * Validates a fødselsnummer candidate using the MOD11 algorithm.
     * Separators (space, dash) are stripped before validation.
     * Returns true only for numbers with correct check digits.
     */
    fun isValidFodselsnummer(value: String): Boolean {
        val digits = value.replace(Regex("[\\s-]"), "")
        if (digits.length != 11 || digits.any { !it.isDigit() }) return false

        val d = digits.map { it.digitToInt() }

        val weights1 = intArrayOf(3, 7, 6, 1, 8, 9, 4, 5, 2)
        val sum1 = weights1.indices.sumOf { d[it] * weights1[it] }
        val rem1 = sum1 % 11
        val check1 = if (rem1 == 0) 0 else 11 - rem1
        if (check1 == 10 || check1 != d[9]) return false

        val weights2 = intArrayOf(5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
        val sum2 = weights2.indices.sumOf { d[it] * weights2[it] }
        val rem2 = sum2 % 11
        val check2 = if (rem2 == 0) 0 else 11 - rem2
        return check2 != 10 && check2 == d[10]
    }

    /**
     * NAV employee identifier (NAVident) - letter followed by 6 digits
     * Format: X123456
     */
    val NAVIDENT = Regex("""\b[a-zA-Z]\d{6}\b""")
    
    /**
     * Email addresses
     */
    val EMAIL = Regex("""\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b""")
    
    /**
     * IP addresses (IPv4)
     */
    val IP_ADDRESS = Regex("""\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b""")
    
    /**
     * Norwegian phone numbers (8 digits starting with 2-9).
     * Handles common separator formats: no separator, spaces (XX XX XX XX,
     * XXX XX XXX, XXXX XXXX) and dashes (e.g. 987-65-432).
     * Negative lookbehind/ahead to avoid matching hex strings or UUIDs.
     */
    val PHONE_NUMBER = Regex("""(?<![0-9a-fA-F-])[2-9](?:\d[\s-]?){6}\d(?![0-9a-fA-F-])""")
    
    /**
     * Credit/debit card numbers (16 digits with optional separators)
     */
    val BANK_CARD = Regex("""(?<![0-9a-fA-F]-)\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b(?!-[0-9a-fA-F])""")
    
    /**
     * Possible Norwegian names (two or three capitalized words)
     * This has false positives but catches many real names
     */
    val POSSIBLE_NAME = Regex("""\b[A-ZÆØÅ][a-zæøå]{1,20}\s[A-ZÆØÅ][a-zæøå]{1,20}(?:\s[A-ZÆØÅ][a-zæøå]{1,20})?\b""")
    
    /**
     * Norwegian postal code followed by place name
     * Format: 1234 Placename
     */
    val POSSIBLE_ADDRESS = Regex("""\b\d{4}\s[A-ZÆØÅ][A-ZÆØÅa-zæøå]+(?:\s[A-ZÆØÅa-zæøå]+)*\b""")
    
    /**
     * "Hemmelig adresse" (secret/protected address marker)
     */
    val SECRET_ADDRESS = Regex("""hemmelig(?:%20|\s+)(?:20\s*%(?:%20|\s+))?adresse""", RegexOption.IGNORE_CASE)
    
    /**
     * Norwegian bank account number (11 digits with optional dots)
     * Format: 1234.56.12345 or 12345612345
     */
    val BANK_ACCOUNT = Regex("""\b\d{4}\.?\d{2}\.?\d{5}\b""")
    
    /**
     * Norwegian organization number (9 digits)
     */
    val ORG_NUMBER = Regex("""\b\d{9}\b""")
    
    /**
     * Norwegian license plate (2 letters + 5 digits)
     * Format: AB 12345 or AB12345
     */
    val LICENSE_PLATE = Regex("""\b[A-Z]{2}\s?\d{5}\b""")
    
    /**
     * Search query parameters in URLs
     */
    val SEARCH_QUERY = Regex("""[?&](?:q|query|search|k|ord)=[^&]+""")
    
    /**
     * All patterns with their labels for reporting
     */
    val ALL_PATTERNS: List<SensitivePattern> = listOf(
        SensitivePattern("fødselsnummer", FODSELSNUMMER, "[FØDSELSNUMMER FJERNET]", ::isValidFodselsnummer),
        SensitivePattern("navident", NAVIDENT, "[NAVIDENT FJERNET]"),
        SensitivePattern("e-post", EMAIL, "[E-POST FJERNET]"),
        SensitivePattern("ip-adresse", IP_ADDRESS, "[IP-ADRESSE FJERNET]"),
        SensitivePattern("telefonnummer", PHONE_NUMBER, "[TELEFON FJERNET]"),
        SensitivePattern("bankkort", BANK_CARD, "[KORTNUMMER FJERNET]"),
        SensitivePattern("mulig_navn", POSSIBLE_NAME, "[MULIG NAVN FJERNET]"),
        SensitivePattern("mulig_adresse", POSSIBLE_ADDRESS, "[MULIG ADRESSE FJERNET]"),
        SensitivePattern("hemmelig_adresse", SECRET_ADDRESS, "[HEMMELIG ADRESSE]"),
        SensitivePattern("kontonummer", BANK_ACCOUNT, "[KONTONUMMER FJERNET]"),
        SensitivePattern("organisasjonsnummer", ORG_NUMBER, "[ORGNUMMER FJERNET]"),
        SensitivePattern("bilnummer", LICENSE_PLATE, "[BILNUMMER FJERNET]"),
        SensitivePattern("søkeparameter", SEARCH_QUERY, "[SØKEPARAMETER FJERNET]"),
    )

    /**
     * High-confidence patterns that should always be filtered
     */
    val HIGH_CONFIDENCE_PATTERNS: List<SensitivePattern> = listOf(
        SensitivePattern("fødselsnummer", FODSELSNUMMER, "[FØDSELSNUMMER FJERNET]", ::isValidFodselsnummer),
        SensitivePattern("navident", NAVIDENT, "[NAVIDENT FJERNET]"),
        SensitivePattern("e-post", EMAIL, "[E-POST FJERNET]"),
        SensitivePattern("telefonnummer", PHONE_NUMBER, "[TELEFON FJERNET]"),
        SensitivePattern("bankkort", BANK_CARD, "[KORTNUMMER FJERNET]"),
        SensitivePattern("kontonummer", BANK_ACCOUNT, "[KONTONUMMER FJERNET]"),
        SensitivePattern("hemmelig_adresse", SECRET_ADDRESS, "[HEMMELIG ADRESSE]"),
    )
}

data class SensitivePattern(
    val name: String,
    val pattern: Regex,
    val replacement: String,
    val validator: ((String) -> Boolean)? = null
)

data class SensitiveDataMatch(
    val patternName: String,
    val matchedValue: String,
    val startIndex: Int,
    val endIndex: Int
)

data class RedactionResult(
    val originalText: String,
    val redactedText: String,
    val matches: List<SensitiveDataMatch>,
    val wasRedacted: Boolean
) {
    val matchCount: Int get() = matches.size
    val matchedPatterns: Set<String> get() = matches.map { it.patternName }.toSet()
}
