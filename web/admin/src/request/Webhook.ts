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
  DeleteApiV1WebhookIdParams,
  DomainPWResponse,
  DomainWebhook,
  DomainWebhookDelivery,
  GetApiV1WebhookIdDeliveriesParams,
  GetApiV1WebhookListParams,
  PostApiV1WebhookIdTestParams,
  PutApiV1WebhookIdParams,
} from "./types";

/**
 * @description 注册一个事件推送目标
 *
 * @tags webhook
 * @name PostApiV1Webhook
 * @summary 创建 Webhook
 * @request POST:/api/v1/webhook
 * @response `200` `(DomainPWResponse & {
    data?: DomainWebhook,

})` OK
 */

export const postApiV1Webhook = (
  body: DomainWebhook,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainWebhook;
    }
  >({
    path: `/api/v1/webhook`,
    method: "POST",
    body: body,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description 列出当前知识库的全部 Webhook
 *
 * @tags webhook
 * @name GetApiV1WebhookList
 * @summary Webhook 列表
 * @request GET:/api/v1/webhook/list
 * @response `200` `(DomainPWResponse & {
    data?: (DomainWebhook)[],

})` OK
 */

export const getApiV1WebhookList = (
  query: GetApiV1WebhookListParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainWebhook[];
    }
  >({
    path: `/api/v1/webhook/list`,
    method: "GET",
    query: query,
    format: "json",
    ...params,
  });

/**
 * @description 修改推送地址、事件订阅与启用状态
 *
 * @tags webhook
 * @name PutApiV1WebhookId
 * @summary 更新 Webhook
 * @request PUT:/api/v1/webhook/{id}
 * @response `200` `DomainPWResponse` OK
 */

export const putApiV1WebhookId = (
  { id, ...query }: PutApiV1WebhookIdParams,
  body: DomainWebhook,
  params: RequestParams = {},
) =>
  httpRequest<DomainPWResponse>({
    path: `/api/v1/webhook/${id}`,
    method: "PUT",
    body: body,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description 删除推送目标及其投递记录
 *
 * @tags webhook
 * @name DeleteApiV1WebhookId
 * @summary 删除 Webhook
 * @request DELETE:/api/v1/webhook/{id}
 * @response `200` `DomainPWResponse` OK
 */

export const deleteApiV1WebhookId = (
  { id, ...query }: DeleteApiV1WebhookIdParams,
  params: RequestParams = {},
) =>
  httpRequest<DomainPWResponse>({
    path: `/api/v1/webhook/${id}`,
    method: "DELETE",
    query: query,
    format: "json",
    ...params,
  });

/**
 * @description 返回某 Webhook 最近 20 条投递记录
 *
 * @tags webhook
 * @name GetApiV1WebhookIdDeliveries
 * @summary 投递记录
 * @request GET:/api/v1/webhook/{id}/deliveries
 * @response `200` `(DomainPWResponse & {
    data?: (DomainWebhookDelivery)[],

})` OK
 */

export const getApiV1WebhookIdDeliveries = (
  { id, ...query }: GetApiV1WebhookIdDeliveriesParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainWebhookDelivery[];
    }
  >({
    path: `/api/v1/webhook/${id}/deliveries`,
    method: "GET",
    query: query,
    format: "json",
    ...params,
  });

/**
 * @description 向该 Webhook 推送一条 test 事件用于验证连通性
 *
 * @tags webhook
 * @name PostApiV1WebhookIdTest
 * @summary 发送测试事件
 * @request POST:/api/v1/webhook/{id}/test
 * @response `200` `DomainPWResponse` OK
 */

export const postApiV1WebhookIdTest = (
  { id, ...query }: PostApiV1WebhookIdTestParams,
  params: RequestParams = {},
) =>
  httpRequest<DomainPWResponse>({
    path: `/api/v1/webhook/${id}/test`,
    method: "POST",
    query: query,
    format: "json",
    ...params,
  });
