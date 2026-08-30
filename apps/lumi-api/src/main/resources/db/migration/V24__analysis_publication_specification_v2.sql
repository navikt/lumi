-- Publication specification V1 remains immutable historical provenance, but
-- only newly compiled V2 specifications can become an effective export scope.

ALTER TABLE analysis_control.analysis_product_releases
    DROP CONSTRAINT chk_analysis_product_release_specification_schema_v1,
    ADD CONSTRAINT chk_analysis_product_release_specification_schema_supported
        CHECK (
            publication_specification ->> 'schemaVersion' IS NOT NULL AND
            publication_specification ->> 'schemaVersion' IN ('1', '2')
        );
