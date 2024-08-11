# graphql-sunset

Easily add support for the [`Sunset` header](http://sophiabits.com/blog/what-is-the-http-sunset-header) to your GraphQL server to better communicate upcoming breaking changes.

## Usage

1. Add a `sunset` directive to your schema.
    ```graphql
    directive @sunset(
      url: String!
      when: String!
    ) on FIELD_DEFINITION

    # ...
    ```

    > 💡 If you prefer more specific types (e.g. `Instant!` / `URL!`), then you can use them. If your GraphQL server parses these fields to something other than a string, you will need to specify a custom `parseDirectiveArgs` function when instantiating the plugin.

2. Apply it to a field:
    ```graphql
    type Query {
      greeting: String @sunset(
        url: "https://docs.your-app.com/removal-of-greeting"
        when: "2025-01-01T00:00:00.000Z"
      )
    }
    ```

3. Add the plugin to your Apollo server.
    ```typescript
    import { ApolloSunsetPlugin } from 'graphql-sunset';

    // ...

    const server = new ApolloServer({
      // ...
      plugins: [
        new ApolloSunsetPlugin({
          directiveName: 'sunset',
          // parseDirectiveArgs
        }),
      ],
    });
    ```

4. Run a GraphQL operation, and see the `Link` and `Sunset` headers get populated:
    ```
    $ curl --include --request POST \
        --header 'content-type: application/json' \
        --url http://localhost:4000/ \
        --data '{"query":"query ExampleQuery {\n  greeting\n}"}'
    HTTP/1.1 200 OK
    ...
    sunset: Wed, 01 Jan 2025 00:00:00 GMT
    link: <https://docs.your-app.com/removal-of-greeting>; rel="sunset"
    ...

    {"data":{"greeting":"Bar"}}
    ```

## Roadmap

- [x] Output fields
- [x] Field arguments
- [x] Input object fields
- [ ] Enum values
- [ ] Envelop server plugin
