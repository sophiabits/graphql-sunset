export interface Sunset {
  url: string;
  when: Date;
}

export interface SunsetPluginOptions {
  /**
   * The name of the directive to look for in the schema.
   * @default "sunset"
   */
  directiveName?: string;

  /**
   * A function to parse the arguments of the directive.
   */
  parseDirectiveArgs?: (args: unknown) => Sunset;
}
