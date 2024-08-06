import { type DirectableGraphQLObject, getDirective } from '@graphql-tools/utils';
import {
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLType,
  type GraphQLInputType,
  type GraphQLSchema,
} from 'graphql';
import type { HeaderMap } from '@apollo/server';

import type { Sunset, SunsetPluginOptions } from './types';

// https://stackoverflow.com/a/74508181
export function formatHTTPDate(date: Date): string {
  const dateString = date
    .toLocaleString('en-GB', {
      timeZone: 'UTC',
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/(?:(\d),)/, '$1');
  return `${dateString} GMT`;
}

export function getSunsetOrNull(
  schema: GraphQLSchema,
  node: DirectableGraphQLObject,
  options: Required<SunsetPluginOptions>,
): Sunset | null {
  const rawSunset = getDirective(schema, node, options.directiveName);
  if (rawSunset && rawSunset.length > 0) {
    return options.parseDirectiveArgs(rawSunset[0]);
  }
  return null;
}

// I need a function which will append or set the Link HTTP header
export function pushSunsetLink(headers: HeaderMap, sunset: Sunset): void {
  const entry = `<${sunset.url}>; rel="sunset"`;
  const linkHeader = headers.get('Link');

  if (!linkHeader) {
    headers.set('Link', entry);
  } else {
    headers.set('Link', `${linkHeader}, ${entry}`);
  }
}

export function unwrapNulls(
  input: GraphQLInputType,
): Exclude<GraphQLInputType, GraphQLNonNull<any>> {
  if (isGraphQLLNonNull(input)) {
    return unwrapNulls(input.ofType);
  }

  return input;
}

function isGraphQLLNonNull(input: GraphQLType): input is GraphQLNonNull<any> {
  return 'ofType' in input && input.constructor.name === 'GraphQLNonNull';
}

export function isGraphQLList(input: GraphQLType | GraphQLInputField): input is GraphQLList<any> {
  return 'ofType' in input && input.constructor.name === 'GraphQLList';
}

export function isGraphQLInputObject(
  input: GraphQLType | GraphQLInputField,
): input is GraphQLInputObjectType {
  return input.constructor.name === 'GraphQLInputObjectType';
}
