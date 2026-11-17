package com.example.bookpractice.infrastructure.clicklog;

import com.example.bookpractice.domain.ClickLog;
import com.example.bookpractice.domain.ClickLogRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public class MysqlClickLogRepository implements ClickLogRepository {

    private final ClickLogJpaRepository clickLogJpaRepository;

    public MysqlClickLogRepository(ClickLogJpaRepository clickLogJpaRepository) {
        this.clickLogJpaRepository = clickLogJpaRepository;
    }

    @Override
    public void save(String shortenUrlKey, LocalDateTime clickedAt) {
        clickLogJpaRepository.save(new ClickLogEntity(shortenUrlKey, clickedAt));
    }

    @Override
    public List<ClickLog> findPage(String shortenUrlKey, LocalDateTime from, LocalDateTime toExclusive,
                                   Long beforeId, int limit) {
        return clickLogJpaRepository
                .findPage(shortenUrlKey, from, toExclusive, beforeId, PageRequest.of(0, limit))
                .stream()
                .map(entity -> new ClickLog(entity.getId(), entity.getClickedAt()))
                .toList();
    }
}