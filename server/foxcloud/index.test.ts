import { mockFetch, sent } from '../test/setup';
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { getValues } from './index';

const PATH = '/op/v0/device/real/query';
const ROUTE = `POST ${PATH}`;

describe('getValues', () => {
  test('signs with literal backslash-r-backslash-n separators, not real newlines', async () => {
    mockFetch({ [ROUTE]: () => Response.json({ errno: 0, result: [{ datas: [] }] }) });
    await getValues();
    const headers = sent(ROUTE)[0]?.headers;
    const timestamp = headers?.get('timestamp');
    const signed = String.raw`${PATH}\r\ntest-fox-key\r\n${timestamp}`;
    expect(headers?.get('signature')).toBe(createHash('md5').update(signed).digest('hex'));
  });

  test('returns readings keyed by variable name', async () => {
    const solar = { variable: 'pvPower', value: 1.5 };
    mockFetch({ [ROUTE]: () => Response.json({ errno: 0, result: [{ datas: [solar] }] }) });
    expect((await getValues()).pvPower).toEqual(solar as never);
  });

  test('throws on a FoxCloud error, which still arrives as HTTP 200', async () => {
    mockFetch({ [ROUTE]: () => Response.json({ errno: 40256 }) });
    await expect(getValues()).rejects.toThrow('40256');
  });
});
