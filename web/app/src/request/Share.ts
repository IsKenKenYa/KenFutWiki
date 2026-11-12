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
  DomainKenFutVoteReq,
  DomainKenFutVoteSummaryResp,
  DomainPWResponse,
  GetShareV1NodeNodeIdVoteParams,
  PostShareV1NodeNodeIdVoteParams,
} from "./types";

/**
 * No description
 *
 * @tags share
 * @name GetShareV1NodeNodeIdVote
 * @summary Page vote summary
 * @request GET:/share/v1/node/{node_id}/vote
 * @response `200` `(DomainPWResponse & {
    data?: DomainKenFutVoteSummaryResp,

})` OK
 */

export const getShareV1NodeNodeIdVote = (
  { nodeId, ...query }: GetShareV1NodeNodeIdVoteParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainKenFutVoteSummaryResp;
    }
  >({
    path: `/share/v1/node/${nodeId}/vote`,
    method: "GET",
    ...params,
  });

/**
 * No description
 *
 * @tags share
 * @name PostShareV1NodeNodeIdVote
 * @summary Vote a published page
 * @request POST:/share/v1/node/{node_id}/vote
 * @response `200` `DomainPWResponse` OK
 */

export const postShareV1NodeNodeIdVote = (
  { nodeId, ...query }: PostShareV1NodeNodeIdVoteParams,
  body: DomainKenFutVoteReq,
  params: RequestParams = {},
) =>
  httpRequest<DomainPWResponse>({
    path: `/share/v1/node/${nodeId}/vote`,
    method: "POST",
    body: body,
    type: ContentType.Json,
    ...params,
  });
