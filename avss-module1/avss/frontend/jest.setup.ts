import '@testing-library/jest-dom';

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'ok', service: 'AVSS Backend', database_connected: true }),
    } as Response),
  ) as unknown as typeof fetch;
});
