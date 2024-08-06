import { ApolloServer } from '@apollo/server';
import { describe, expect, it } from 'vitest';
import { gql } from 'graphql-tag';

import { ApolloSunsetPlugin } from './plugin';

const typeDefs = gql`
  directive @sunset(
    url: String!
    when: String!
  ) on ARGUMENT_DEFINITION | FIELD_DEFINITION | INPUT_FIELD_DEFINITION

  input PostInput {
    title: String @sunset(url: "https://example.com", when: "2099-01-01T12:00:00.000Z")
  }

  type Query {
    noSunset: String
    withSunset: String @sunset(url: "https://foo.com", when: "2099-10-01T12:00:00.000Z")

    sunsetArgs(
      input: String @sunset(url: "https://bar.com", when: "2099-11-15T12:00:00.000Z")
    ): String
    sunsetArgsDefault(
      input: String = "default" @sunset(url: "https://bar.com", when: "2099-12-25T12:00:00.000Z")
    ): String

    sunsetInputObject(input: PostInput): String
    sunsetInputObjectComplex(input: [[PostInput!]!]!): String
  }
`;

const resolvers = {
  Query: {
    noSunset: () => 'Foo',
    withSunset: () => 'Bar',
    sunsetArgs: () => 'Baz',
    sunsetArgsDefault: () => 'Qux',
    sunsetInputObject: () => 'Quux',
    sunsetInputObjectComplex: () => 'Quuux',
  },
};

const server = new ApolloServer({
  plugins: [new ApolloSunsetPlugin()],
  resolvers,
  typeDefs,
});

describe('ApolloSunsetPlugin', () => {
  it('does not erroneously sunset fields', async () => {
    const response = await server.executeOperation({
      query: gql`
        query {
          noSunset
        }
      `,
    });

    expect(response.http.headers.get('Link')).toBe(undefined);
    expect(response.http.headers.get('Sunset')).toBe(undefined);
  });

  it('can sunset fields', async () => {
    const response = await server.executeOperation({
      query: gql`
        query {
          withSunset
        }
      `,
    });

    expect(response.http.headers.get('Link')).toBe('<https://foo.com>; rel="sunset"');
    expect(response.http.headers.get('Sunset')).toBe('Thu, 01 Oct 2099 12:00:00 GMT');
  });

  it('sunsets fragment spreads', async () => {
    const response = await server.executeOperation({
      query: gql`
        fragment f on Query {
          withSunset
        }

        query {
          ...f
        }
      `,
    });

    expect(response.http.headers.get('Link')).toBe('<https://foo.com>; rel="sunset"');
    expect(response.http.headers.get('Sunset')).toBe('Thu, 01 Oct 2099 12:00:00 GMT');
  });

  it('can sunset input args', async () => {
    const response = await server.executeOperation({
      query: gql`
        query {
          sunsetArgs(input: "qux")
        }
      `,
    });

    expect(response.http.headers.get('Link')).toBe('<https://bar.com>; rel="sunset"');
    expect(response.http.headers.get('Sunset')).toBe('Sun, 15 Nov 2099 12:00:00 GMT');
  });

  it('returns multiple sunset Links', async () => {
    const response = await server.executeOperation({
      query: gql`
        query {
          sunsetArgs(input: "qux")
          withSunset
        }
      `,
    });

    expect(response.http.headers.get('Link')).toBe(
      '<https://bar.com>; rel="sunset", <https://foo.com>; rel="sunset"',
    );
    expect(response.http.headers.get('Sunset')).toBe('Thu, 01 Oct 2099 12:00:00 GMT');
  });

  it('does not return sunset header when sunset arg is used with default value', async () => {
    const response = await server.executeOperation({
      query: gql`
        query {
          sunsetArgsDefault
        }
      `,
    });

    expect(response.http.headers.get('Link')).toBe(undefined);
    expect(response.http.headers.get('Sunset')).toBe(undefined);
  });

  it('can sunset input object fields', async () => {
    const response = await server.executeOperation({
      query: gql`
        query {
          sunsetInputObject(input: { title: "Foo" })
        }
      `,
    });

    expect(response.http.headers.get('Link')).toBe('<https://example.com>; rel="sunset"');
    expect(response.http.headers.get('Sunset')).toBe('Thu, 01 Jan 2099 12:00:00 GMT');
  });

  it('can sunset input object fields (complicated)', async () => {
    const response = await server.executeOperation({
      query: gql`
        query {
          sunsetInputObjectComplex(input: [[{ title: "Foo" }]])
        }
      `,
    });

    expect(response.http.headers.get('Link')).toBe('<https://example.com>; rel="sunset"');
    expect(response.http.headers.get('Sunset')).toBe('Thu, 01 Jan 2099 12:00:00 GMT');
  });

  it.skip('merges existing Link header', () => {
    // NYI
  });
});
