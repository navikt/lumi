/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * This algorithm is updated based on code located at:
 * http://members.unine.ch/jacques.savoy/clef/
 *
 * Copyright (c) 2005, Jacques Savoy
 * All rights reserved.
 */

package no.nav.lumi.service.text

/**
 * Light stemmer for Norwegian (Bokmål).
 *
 * Ported from Apache Lucene's `NorwegianLightStemmer` (Java → Kotlin).
 * Only Bokmål mode is enabled (Nynorsk-specific rules are excluded).
 *
 * The stemmer removes common inflectional suffixes (definite/indefinite articles,
 * plural markers, adjective and verb endings). It does NOT handle derivational
 * morphology or compound-word splitting.
 *
 * The resulting stem is intended for **grouping**, not display. Use
 * [StemWordAccumulator.getCanonicalForm] for human-readable output.
 *
 * @see <a href="https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/no/NorwegianLightStemmer.java">Original source</a>
 */
object NorwegianLightStemmer {

    /**
     * Stem a single Norwegian word (Bokmål).
     *
     * @param word lowercase word to stem
     * @return stemmed form (may be the same string if no rule applies)
     */
    fun stem(word: String): String {
        val s = word.toCharArray()
        val len = stemInternal(s, s.size)
        return String(s, 0, len)
    }

    /**
     * Internal stemming operating on a char array (mirrors Lucene's signature).
     * Returns the new effective length after suffix removal.
     */
    private fun stemInternal(s: CharArray, length: Int): Int {
        var len = length

        // Remove possessive -s (e.g. "bilens" → "bilen", then continue)
        if (len > 4 && s[len - 1] == 's') len--

        // 5-char suffixes
        if (len > 7 && (endsWith(s, len, "heter") || endsWith(s, len, "heten")))
            return len - 5

        // 3-char suffixes
        if (len > 5 && (endsWith(s, len, "dom") || endsWith(s, len, "het")))
            return len - 3

        // 5-char suffixes (else-family)
        if (len > 7 && (endsWith(s, len, "elser") || endsWith(s, len, "elsen")))
            return len - 5

        // 4-char suffixes
        if (len > 6 && (
                endsWith(s, len, "ende") ||  // present participle (sov-ende)
                endsWith(s, len, "else") ||  // nominalization (føl-else)
                endsWith(s, len, "este") ||  // superlative (fin-este)
                endsWith(s, len, "eren")     // masculine agent (lær-eren)
            )
        ) return len - 4

        // 3-char suffixes
        if (len > 5 && (
                endsWith(s, len, "ere") ||   // comparative (fin-ere)
                endsWith(s, len, "est") ||   // superlative (fin-est)
                endsWith(s, len, "ene")      // plural definite (hus-ene)
            )
        ) return len - 3

        // 2-char suffixes
        if (len > 4 && (
                endsWith(s, len, "er") ||    // plural indefinite / agent
                endsWith(s, len, "en") ||    // masculine/feminine definite
                endsWith(s, len, "et") ||    // neuter definite
                endsWith(s, len, "st") ||    // superlative short (billig-st)
                endsWith(s, len, "te")       // past tense (kast-te)
            )
        ) return len - 2

        // 1-char suffixes
        if (len > 3) {
            when (s[len - 1]) {
                'a' -> return len - 1   // feminine definite (bok-a)
                'e' -> return len - 1   // infinitive / noun-e (kake → kak)
                'n' -> return len - 1   // residual -n
            }
        }

        return len
    }

    private fun endsWith(s: CharArray, len: Int, suffix: String): Boolean {
        if (len < suffix.length) return false
        for (i in suffix.indices) {
            if (s[len - suffix.length + i] != suffix[i]) return false
        }
        return true
    }
}
