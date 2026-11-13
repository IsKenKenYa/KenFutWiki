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
  DeleteApiV1NodeTemplateIdParams,
  DomainCreateNodeTemplateReq,
  DomainNodeTemplate,
  DomainPWResponse,
  DomainUpdateNodeTemplateReq,
  GetApiV1NodeTemplateListParams,
  PutApiV1NodeTemplateIdParams,
} from "./types";

/**
 * @description 保存一份文档模板供新建文档时复制
 *
 * @tags node_template
 * @name PostApiV1NodeTemplate
 * @summary 创建文档模板
 * @request POST:/api/v1/node_template
 * @response `200` `(DomainPWResponse & {
    data?: DomainNodeTemplate,

})` OK
 */

export const postApiV1NodeTemplate = (
  body: DomainCreateNodeTemplateReq,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainNodeTemplate;
    }
  >({
    path: `/api/v1/node_template`,
    method: "POST",
    body: body,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description 列出当前知识库的全部文档模板
 *
 * @tags node_template
 * @name GetApiV1NodeTemplateList
 * @summary 文档模板列表
 * @request GET:/api/v1/node_template/list
 * @response `200` `(DomainPWResponse & {
    data?: (DomainNodeTemplate)[],

})` OK
 */

export const getApiV1NodeTemplateList = (
  query: GetApiV1NodeTemplateListParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainNodeTemplate[];
    }
  >({
    path: `/api/v1/node_template/list`,
    method: "GET",
    query: query,
    format: "json",
    ...params,
  });

/**
 * @description 修改模板名称、摘要与内容
 *
 * @tags node_template
 * @name PutApiV1NodeTemplateId
 * @summary 更新文档模板
 * @request PUT:/api/v1/node_template/{id}
 * @response `200` `DomainPWResponse` OK
 */

export const putApiV1NodeTemplateId = (
  { id, ...query }: PutApiV1NodeTemplateIdParams,
  body: DomainUpdateNodeTemplateReq,
  params: RequestParams = {},
) =>
  httpRequest<DomainPWResponse>({
    path: `/api/v1/node_template/${id}`,
    method: "PUT",
    body: body,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description 删除指定的文档模板
 *
 * @tags node_template
 * @name DeleteApiV1NodeTemplateId
 * @summary 删除文档模板
 * @request DELETE:/api/v1/node_template/{id}
 * @response `200` `DomainPWResponse` OK
 */

export const deleteApiV1NodeTemplateId = (
  { id, ...query }: DeleteApiV1NodeTemplateIdParams,
  params: RequestParams = {},
) =>
  httpRequest<DomainPWResponse>({
    path: `/api/v1/node_template/${id}`,
    method: "DELETE",
    query: query,
    format: "json",
    ...params,
  });
