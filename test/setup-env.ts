process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@127.0.0.1:5432/muralpay?schema=public';
process.env.MURAL_API_KEY ??= 'e2e-test-key';
process.env.MURAL_ORGANIZATION_ID ??= '00000000-0000-4000-8000-000000000001';
