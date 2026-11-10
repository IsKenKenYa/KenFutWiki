/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import httpRequest, { ContentType, RequestParams } from "./httpClient";
import {
  DomainMCPCallListItem,
  DomainPWResponse,
  GetApiV1McpCallsParams,
} from "./types";

/**
 * @description List recent MCP tool calls of the knowledge base
 *
 * @tags MCP
 * @name GetApiV1McpCalls
 * @summary List MCP tool calls
 * @request GET:/api/v1/mcp/calls
 * @secure
 * @response `200` `(DomainPWResponse & {
    data?: (DomainMCPCallListItem)[],

})` OK
 */

export const getApiV1McpCalls = (
  query: GetApiV1McpCallsParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainMCPCallListItem[];
    }
  >({
    path: `/api/v1/mcp/calls`,
    method: "GET",
    query: query,
    secure: true,
    type: ContentType.Json,
    format: "json",
    ...params,
  });
