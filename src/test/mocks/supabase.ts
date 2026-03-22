import { vi } from "vitest";

type QueryResult = { data: unknown; error: unknown };

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
}

export interface MockSupabaseClient {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
}

interface MockConfig {
  user?: { id: string; email?: string } | null;
  tables?: Record<string, QueryResult>;
}

export function createMockSupabaseClient(config: MockConfig = {}): MockSupabaseClient {
  const { user = null, tables = {} } = config;

  const defaultResult: QueryResult = { data: [], error: null };

  function createQueryBuilder(tableName: string): MockQueryBuilder {
    const result = tables[tableName] || defaultResult;

    const builder: MockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(result),
      then: vi.fn((resolve: (value: QueryResult) => void) => resolve(result)),
    };

    // Make the builder itself thenable so `await query` resolves
    const proxy = new Proxy(builder, {
      get(target, prop) {
        if (prop === "then") {
          return (resolve: (value: QueryResult) => void) => resolve(result);
        }
        return target[prop as keyof MockQueryBuilder];
      },
    });

    // Chain methods return the proxy
    for (const method of ["select", "insert", "update", "delete", "eq", "in", "or", "order", "range"] as const) {
      builder[method].mockReturnValue(proxy);
    }
    builder.single.mockResolvedValue(result);

    return proxy as MockQueryBuilder;
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
    from: vi.fn((tableName: string) => createQueryBuilder(tableName)),
  };
}

/** Helper to mock the server createClient */
export function mockCreateClient(client: MockSupabaseClient) {
  return vi.fn().mockResolvedValue(client);
}
