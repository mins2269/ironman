package com.example.bookpractice.domain;

import java.time.LocalDateTime;
import java.util.List;

public interface ClickLogRepository {

    void save(String shortenUrlKey, LocalDateTime clickedAt);

    /** 최근 접속 시각을 최신순으로 최대 20건 반환한다. */
    List<LocalDateTime> findRecentClickedAt(String shortenUrlKey);
}