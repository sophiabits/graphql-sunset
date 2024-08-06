import type {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import type { Path } from '@graphql-tools/utils';
import { z } from 'zod';

import {
  formatHTTPDate,
  getSunsetOrNull,
  isGraphQLInputObject,
  isGraphQLList,
  pushSunsetLink,
  unwrapNulls,
} from './util';
import type { Sunset, SunsetPluginOptions } from './types';
import { GraphQLInputType, GraphQLSchema } from 'graphql';

const SunsetDirectiveArgsSchema = z.object({
  url: z.string().url(),
  when: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
});

const defaultOptions: Required<SunsetPluginOptions> = {
  directiveName: 'sunset',
  parseDirectiveArgs: SunsetDirectiveArgsSchema.parse,
};

export class ApolloSunsetPlugin implements ApolloServerPlugin {
  private readonly opts: Required<SunsetPluginOptions>;

  constructor(opts?: SunsetPluginOptions) {
    this.opts = {
      ...defaultOptions,
      ...opts,
    };
  }

  async requestDidStart(
    requestContext: GraphQLRequestContext<BaseContext>,
  ): Promise<GraphQLRequestListener<BaseContext>> {
    const logger = requestContext.logger;
    const schema = requestContext.schema;
    const startedAt = new Date();

    const sunsets: Sunset[] = [];

    function handleSunset(path: Path, sunset: Sunset) {
      const isSunsetInFuture = sunset.when.getTime() > startedAt.getTime();
      if (isSunsetInFuture) {
        sunsets.push(sunset);
      } else {
        logger.warn(`Sunset date is in the past for field \`${path.typename}.${path.key}\``);
      }
    }

    const walkArg = (
      schema: GraphQLSchema,
      parentName: string,
      values: Record<string, any>,
      argType: GraphQLInputType,
    ) => {
      if (isGraphQLList(argType)) {
        for (const value of Object.values(values)) {
          walkArg(schema, parentName, value, unwrapNulls(argType.ofType));
        }
      } else if (isGraphQLInputObject(argType)) {
        const inputObjectFields = Object.entries(argType.getFields());
        for (const [fieldName, fieldType] of inputObjectFields) {
          // TODO: Is there a way of determining whether the consumer set the default value?
          if (values[fieldName] === fieldType.defaultValue) {
            continue;
          }

          const sunset = getSunsetOrNull(schema, fieldType, this.opts);
          if (sunset) {
            handleSunset(
              {
                key: fieldName,
                typename: parentName,
                prev: undefined,
              },
              sunset,
            );
          }

          if (isGraphQLInputObject(fieldType) || isGraphQLList(fieldType)) {
            walkArg(schema, fieldType.name, values[fieldName], fieldType);
          }
        }
      }
    };

    return {
      executionDidStart: async () => ({
        willResolveField: (fieldResolverParams) => {
          const parentType = fieldResolverParams.info.parentType;
          const fieldName = fieldResolverParams.info.fieldName;
          const field = parentType.getFields()[fieldName];

          if (!field) {
            return;
          }

          // Handle FIELD_DEFINITION sunsets
          const fieldSunset = getSunsetOrNull(schema, field, this.opts);
          if (fieldSunset) {
            handleSunset(fieldResolverParams.info.path, fieldSunset);
          }

          // Handle ARGUMENT_DEFINITION sunsets
          for (const arg of field.args) {
            if (arg.defaultValue === fieldResolverParams.args[arg.name]) {
              // TODO: Is there a way of determining whether the consumer set the default value?
              continue;
            }

            const argSunset = getSunsetOrNull(schema, arg, this.opts);
            if (argSunset) {
              handleSunset({ key: arg.name, typename: field.name, prev: undefined }, argSunset);
            }

            // Handle INPUT_FIELD_DEFINITION sunsets
            walkArg(schema, field.name, fieldResolverParams.args[arg.name], unwrapNulls(arg.type));
          }
        },
      }),
      async willSendResponse(requestContext) {
        const earliestSunset = sunsets.reduce<Sunset | null>(
          (earliest, current) => (earliest && earliest.when < current.when ? earliest : current),
          null,
        );
        const seenUrls = new Set<string>();

        if (earliestSunset) {
          requestContext.response.http.headers.set('Sunset', formatHTTPDate(earliestSunset.when));
          for (const sunset of sunsets) {
            if (!seenUrls.has(sunset.url)) {
              pushSunsetLink(requestContext.response.http.headers, sunset);
              seenUrls.add(sunset.url);
            }
          }
        }
      },
    };
  }
}
