UPDATE "product_categories"
SET "specification_schema" = coalesce(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'key',
        coalesce(nullif(specification->>'key', ''), lower(regexp_replace(specification->>'label', '[^a-zA-Z0-9]+', '_', 'g'))),
        'label',
        specification->>'label'
      )
      ORDER BY specification_index
    )
    FROM jsonb_array_elements("product_categories"."specification_schema") WITH ORDINALITY AS specs(specification, specification_index)
    WHERE nullif(specification->>'label', '') IS NOT NULL
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof("specification_schema") = 'array';
