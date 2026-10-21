package no.nav.lumi.domain

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant

/*
 * BigQuery export to a dataset in the team's own GCP project (ADR 0007).
 *
 * Column names are the public contract for analysts and are written in Norwegian without æøå.
 * Changes must be additive. A breaking change needs a new table name.
 */

val BIGQUERY_PROJECT_ID_PATTERN = Regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
val BIGQUERY_DATASET_ID_PATTERN = Regex("^[A-Za-z0-9_]{1,100}$")

/** Dataset label that proves the dataset was set up for this team's Lumi export. */
const val BIGQUERY_TEAM_LABEL = "lumi-team"

/** Table label Lumi sets on its own tables. Lumi never overwrites or deletes tables without it. */
const val BIGQUERY_EXPORT_TABLE_LABEL = "lumi-eksport"
const val BIGQUERY_EXPORT_TABLE_LABEL_VALUE = "v1"

/** How long BigQuery may keep deleted rows. The SQL from the dashboard sets this. */
const val BIGQUERY_MAX_TIME_TRAVEL_HOURS = 48

data class BigQueryColumn(
    val name: String,
    val type: String,
    val required: Boolean,
    val description: String,
)

enum class BigQueryExportTable(
    val tableId: String,
    val description: String,
    val columns: List<BigQueryColumn>,
) {
    SVAR(
        tableId = "svar",
        description = "Svar fra Lumi. Én rad per svarverdi på vurderings- og valgspørsmål. " +
            "Lumi erstatter innholdet hver natt.",
        columns = listOf(
            BigQueryExportColumns.innsendingId,
            BigQueryExportColumns.innsendtTidspunkt,
            BigQueryExportColumns.innsendtDato,
            BigQueryExportColumns.app,
            BigQueryExportColumns.surveyId,
            BigQueryExportColumns.surveyType,
            BigQueryExportColumns.surveyArkivert,
            BigQueryExportColumns.sporsmalId,
            BigQueryExportColumns.sporsmalTekst,
            BigQueryColumn(
                "sporsmal_type", "STRING", true,
                "Spørsmålstypen: RATING, SINGLE_CHOICE eller MULTI_CHOICE.",
            ),
            BigQueryColumn(
                "rating_verdi", "INTEGER", false,
                "Verdien på vurderingsspørsmål. NPS går fra 0 til 10, tommel er 1 (ned) eller 2 (opp), " +
                    "emoji og stjerner går fra 1 til 5.",
            ),
            BigQueryColumn(
                "rating_variant", "STRING", false,
                "Vurderingsvarianten: emoji, stars, thumbs eller nps.",
            ),
            BigQueryColumn(
                "rating_skala", "INTEGER", false,
                "Antall trinn i vurderingen: 5 for emoji og stjerner, 2 for tommel og 11 for NPS.",
            ),
            BigQueryColumn(
                "valg_id", "STRING", false,
                "ID-en til alternativet som ble valgt. Flervalg gir én rad per valgt alternativ.",
            ),
            BigQueryColumn(
                "valg_tekst", "STRING", false,
                "Nyeste tekst for alternativet.",
            ),
            BigQueryExportColumns.enhetstype,
            BigQueryExportColumns.skjemaversjon,
            BigQueryExportColumns.oppdatertTidspunkt,
        ),
    ),
    INNSENDINGER(
        tableId = "innsendinger",
        description = "Innsendinger fra Lumi. Én rad per innsending. Bruk tabellen til totaler. " +
            "Lumi erstatter innholdet hver natt.",
        columns = listOf(
            BigQueryExportColumns.innsendingId,
            BigQueryExportColumns.innsendtTidspunkt,
            BigQueryExportColumns.innsendtDato,
            BigQueryExportColumns.app,
            BigQueryExportColumns.surveyId,
            BigQueryExportColumns.surveyType,
            BigQueryExportColumns.surveyArkivert,
            BigQueryColumn(
                "antall_svar", "INTEGER", true,
                "Antall spørsmål som ble besvart i innsendingen, også fritekst og dato.",
            ),
            BigQueryColumn(
                "har_fritekst", "BOOLEAN", true,
                "Om innsendingen har minst ett fritekstsvar.",
            ),
            BigQueryColumn(
                "varighet_sekunder", "INTEGER", false,
                "Sekunder fra surveyen ble vist til svaret ble sendt, rundet ned. Tom når widgeten ikke sendte tiden.",
            ),
            BigQueryExportColumns.enhetstype,
            BigQueryExportColumns.skjemaversjon,
            BigQueryExportColumns.oppdatertTidspunkt,
        ),
    ),
    FRITEKST(
        tableId = "fritekst",
        description = "Fritekstsvar fra Lumi, med kjente mønstre for personopplysninger maskert. Tekstene kan " +
            "inneholde navn og helseopplysninger. Ikke del tabellen utenfor teamet. Lumi erstatter innholdet hver natt.",
        columns = listOf(
            BigQueryExportColumns.innsendingId,
            BigQueryExportColumns.innsendtTidspunkt,
            BigQueryExportColumns.innsendtDato,
            BigQueryExportColumns.app,
            BigQueryExportColumns.surveyId,
            BigQueryExportColumns.surveyType,
            BigQueryExportColumns.surveyArkivert,
            BigQueryExportColumns.sporsmalId,
            BigQueryExportColumns.sporsmalTekst,
            BigQueryColumn("tekst", "STRING", true, "Fritekstsvaret, med kjente mønstre for personopplysninger maskert."),
            BigQueryColumn(
                "maskert", "BOOLEAN", true,
                "Om Lumi har maskert tekst som så ut som personopplysninger i innsendingen.",
            ),
            BigQueryExportColumns.enhetstype,
            BigQueryExportColumns.skjemaversjon,
            BigQueryExportColumns.oppdatertTidspunkt,
        ),
    ),
}

private object BigQueryExportColumns {
    val innsendingId = BigQueryColumn(
        "innsending_id", "STRING", true,
        "Pseudonym ID for innsendingen. Den er lik i alle tabellene og mellom kjøringer, men blir ny når " +
            "teamet bytter datasett eller setter opp eksporten på nytt.",
    )
    val innsendtTidspunkt = BigQueryColumn(
        "innsendt_tidspunkt", "TIMESTAMP", true,
        "Når Lumi tok imot svaret, rundet ned til hel time.",
    )
    val innsendtDato = BigQueryColumn(
        "innsendt_dato", "DATE", true,
        "Datoen Lumi tok imot svaret, i norsk tid. Samme dag som dashboardet bruker.",
    )
    val app = BigQueryColumn("app", "STRING", true, "Appen som sendte svaret.")
    val surveyId = BigQueryColumn("survey_id", "STRING", true, "Survey-ID-en.")
    val surveyType = BigQueryColumn(
        "survey_type", "STRING", false,
        "Surveytypen: rating, topTasks, taskPriority, discovery eller custom.",
    )
    val surveyArkivert = BigQueryColumn(
        "survey_arkivert", "BOOLEAN", true,
        "Om surveyen er arkivert i dashboardet. Dashboardet skjuler arkiverte surveyer som standard.",
    )
    val sporsmalId = BigQueryColumn(
        "sporsmal_id", "STRING", true,
        "Spørsmålets ID (fieldId). Den er bare unik innenfor én app og én survey.",
    )
    val sporsmalTekst = BigQueryColumn(
        "sporsmal_tekst", "STRING", true,
        "Nyeste spørsmålstekst for spørsmålets ID. Endres teksten i surveyen, endres den for alle rader.",
    )
    val enhetstype = BigQueryColumn(
        "enhetstype", "STRING", false,
        "Enheten svaret ble sendt fra: mobile, tablet eller desktop.",
    )
    val skjemaversjon = BigQueryColumn(
        "skjemaversjon", "STRING", false,
        "Fingeravtrykk av strukturen i surveyen. Endres når spørsmål eller alternativer legges til, fjernes " +
            "eller får ny type, men ikke når teksten endres. Tom for svar fra før Lumi lagret strukturen.",
    )
    val oppdatertTidspunkt = BigQueryColumn(
        "oppdatert_tidspunkt", "TIMESTAMP", true,
        "Når Lumi skrev tabellen. Alle rader fra samme kjøring har samme tidspunkt.",
    )
}

@Serializable
data class SvarExportRow(
    @SerialName("innsending_id") val innsendingId: String,
    @SerialName("innsendt_tidspunkt") val innsendtTidspunkt: String,
    @SerialName("innsendt_dato") val innsendtDato: String,
    val app: String,
    @SerialName("survey_id") val surveyId: String,
    @SerialName("survey_type") val surveyType: String? = null,
    @SerialName("survey_arkivert") val surveyArkivert: Boolean,
    @SerialName("sporsmal_id") val sporsmalId: String,
    @SerialName("sporsmal_tekst") val sporsmalTekst: String,
    @SerialName("sporsmal_type") val sporsmalType: String,
    @SerialName("rating_verdi") val ratingVerdi: Int? = null,
    @SerialName("rating_variant") val ratingVariant: String? = null,
    @SerialName("rating_skala") val ratingSkala: Int? = null,
    @SerialName("valg_id") val valgId: String? = null,
    @SerialName("valg_tekst") val valgTekst: String? = null,
    val enhetstype: String? = null,
    val skjemaversjon: String? = null,
    @SerialName("oppdatert_tidspunkt") val oppdatertTidspunkt: String,
)

@Serializable
data class InnsendingExportRow(
    @SerialName("innsending_id") val innsendingId: String,
    @SerialName("innsendt_tidspunkt") val innsendtTidspunkt: String,
    @SerialName("innsendt_dato") val innsendtDato: String,
    val app: String,
    @SerialName("survey_id") val surveyId: String,
    @SerialName("survey_type") val surveyType: String? = null,
    @SerialName("survey_arkivert") val surveyArkivert: Boolean,
    @SerialName("antall_svar") val antallSvar: Int,
    @SerialName("har_fritekst") val harFritekst: Boolean,
    @SerialName("varighet_sekunder") val varighetSekunder: Long? = null,
    val enhetstype: String? = null,
    val skjemaversjon: String? = null,
    @SerialName("oppdatert_tidspunkt") val oppdatertTidspunkt: String,
)

@Serializable
data class FritekstExportRow(
    @SerialName("innsending_id") val innsendingId: String,
    @SerialName("innsendt_tidspunkt") val innsendtTidspunkt: String,
    @SerialName("innsendt_dato") val innsendtDato: String,
    val app: String,
    @SerialName("survey_id") val surveyId: String,
    @SerialName("survey_type") val surveyType: String? = null,
    @SerialName("survey_arkivert") val surveyArkivert: Boolean,
    @SerialName("sporsmal_id") val sporsmalId: String,
    @SerialName("sporsmal_tekst") val sporsmalTekst: String,
    val tekst: String,
    val maskert: Boolean,
    val enhetstype: String? = null,
    val skjemaversjon: String? = null,
    @SerialName("oppdatert_tidspunkt") val oppdatertTidspunkt: String,
)

/**
 * Stable codes the dashboard maps to texts. A code describes what the team can fix
 * ([isTeamActionable]) or a problem on Lumi's or Google's side.
 */
enum class BigQueryExportProblemCode(val isTeamActionable: Boolean) {
    PROJECT_NOT_TEAM_PROJECT(true),
    DATASET_NOT_FOUND(true),
    DATASET_ACCESS_DENIED(true),
    DATASET_WRONG_LOCATION(true),
    DATASET_TEAM_LABEL_MISSING(true),
    DATASET_TEAM_LABEL_MISMATCH(true),
    TABLE_WRITE_DENIED(true),
    TABLE_NOT_CREATED_BY_LUMI(true),
    DATASET_NOT_DEDICATED(true),
    DATASET_TIME_TRAVEL_TOO_LONG(true),
    TEAM_PROJECT_UNKNOWN(false),
    EXPORT_JOB_DENIED(false),
    BIGQUERY_UNAVAILABLE(false),
    LOAD_FAILED(false),
    INTERNAL_ERROR(false),
}

data class BigQueryExportProblem(
    val code: BigQueryExportProblemCode,
    /** Non-sensitive detail shown to the team, for example the expected project or a table name. */
    val detail: String? = null,
)

enum class BigQueryExportRunStatus { RUNNING, SUCCEEDED, FAILED }

@Serializable
data class BigQueryExportRowCounts(
    val svar: Long,
    val innsendinger: Long,
    val fritekst: Long? = null,
)

data class BigQueryExportDestination(
    val team: String,
    val projectId: String,
    val datasetId: String,
    val includeFreeText: Boolean,
    val pseudonymKey: ByteArray,
    val createdAt: Instant,
    val updatedAt: Instant,
    val runRequestedAt: Instant?,
    val lastRunStartedAt: Instant?,
    val lastRunFinishedAt: Instant?,
    val lastRunStatus: BigQueryExportRunStatus?,
    val lastRunErrorCode: BigQueryExportProblemCode?,
    val consecutiveFailures: Int,
    val lastSuccessAt: Instant?,
    val lastSuccessRows: BigQueryExportRowCounts?,
) {
    override fun equals(other: Any?): Boolean =
        other is BigQueryExportDestination &&
            team == other.team &&
            projectId == other.projectId &&
            datasetId == other.datasetId &&
            includeFreeText == other.includeFreeText &&
            pseudonymKey.contentEquals(other.pseudonymKey) &&
            createdAt == other.createdAt &&
            updatedAt == other.updatedAt &&
            runRequestedAt == other.runRequestedAt &&
            lastRunStartedAt == other.lastRunStartedAt &&
            lastRunFinishedAt == other.lastRunFinishedAt &&
            lastRunStatus == other.lastRunStatus &&
            lastRunErrorCode == other.lastRunErrorCode &&
            consecutiveFailures == other.consecutiveFailures &&
            lastSuccessAt == other.lastSuccessAt &&
            lastSuccessRows == other.lastSuccessRows

    override fun hashCode(): Int = team.hashCode()

    override fun toString(): String =
        "BigQueryExportDestination(team=$team, projectId=$projectId, datasetId=$datasetId, " +
            "includeFreeText=$includeFreeText, lastRunStatus=$lastRunStatus)"
}

@Serializable
data class BigQueryExportDestinationRequest(
    val projectId: String,
    val datasetId: String,
    val includeFreeText: Boolean = false,
)

@Serializable
data class BigQueryExportVerifyRequest(
    val projectId: String,
    val datasetId: String,
)

@Serializable
data class BigQueryExportProblemDto(
    val code: BigQueryExportProblemCode,
    val detail: String? = null,
)

@Serializable
data class BigQueryExportVerificationResponse(
    val ok: Boolean,
    val problems: List<BigQueryExportProblemDto>,
)

@Serializable
enum class BigQueryExportRunState { IDLE, QUEUED, RUNNING }

@Serializable
data class BigQueryExportRunDto(
    val status: BigQueryExportRunStatus,
    val startedAt: String,
    val finishedAt: String? = null,
    val errorCode: BigQueryExportProblemCode? = null,
)

@Serializable
data class BigQueryExportDestinationDto(
    val projectId: String,
    val datasetId: String,
    val includeFreeText: Boolean,
    val createdAt: String,
    val updatedAt: String,
    val runState: BigQueryExportRunState,
    val lastRun: BigQueryExportRunDto? = null,
    val lastSuccessAt: String? = null,
    val lastSuccessRows: BigQueryExportRowCounts? = null,
    val nextScheduledRunAt: String? = null,
)

/** Why the export can or cannot be used by a team in this environment. */
@Serializable
enum class BigQueryExportAvailability { AVAILABLE, DISABLED, PILOT_ONLY }

@Serializable
data class BigQueryExportStatusResponse(
    val team: String,
    val available: Boolean,
    val availability: BigQueryExportAvailability,
    val location: String,
    val serviceAccount: String? = null,
    val suggestedProjectId: String? = null,
    /** Whether the team may export free text. Lumi opens it per team once a PVK covers it. */
    val freeTextAvailable: Boolean = false,
    val destination: BigQueryExportDestinationDto? = null,
)

@Serializable
data class BigQueryExportStopResponse(
    val tablesRemoved: Boolean,
)
